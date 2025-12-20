/**
 * Entity Hierarchy Service
 *
 * Caches entity names and parent-child relationships for quick lookups.
 * This avoids needing to fetch entity details repeatedly from Google Ads API.
 */

import { prisma } from '@/lib/prisma';
import { EntityType, Prisma } from '@prisma/client';

export interface EntityInfo {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  status: string;
  parentEntityId?: string;
  parentEntityType?: EntityType;
}

export class EntityHierarchyService {
  /**
   * Get entity info from cache
   */
  async getEntity(
    customerId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<EntityInfo | null> {
    const entity = await prisma.entityHierarchy.findUnique({
      where: {
        customerId_entityType_entityId: {
          customerId,
          entityType,
          entityId,
        },
      },
    });

    if (!entity) return null;

    return {
      entityId: entity.entityId,
      entityName: entity.entityName,
      entityType: entity.entityType,
      status: entity.status,
      parentEntityId: entity.parentEntityId || undefined,
      parentEntityType: entity.parentEntityType || undefined,
    };
  }

  /**
   * Get all entities of a type for a customer
   */
  async getEntities(
    customerId: string,
    entityType: EntityType,
    options: {
      parentEntityId?: string;
      status?: string[];
      limit?: number;
    } = {}
  ): Promise<EntityInfo[]> {
    const where: Prisma.EntityHierarchyWhereInput = {
      customerId,
      entityType,
    };

    if (options.parentEntityId) {
      where.parentEntityId = options.parentEntityId;
    }

    if (options.status && options.status.length > 0) {
      where.status = { in: options.status };
    }

    const entities = await prisma.entityHierarchy.findMany({
      where,
      take: options.limit,
      orderBy: { entityName: 'asc' },
    });

    return entities.map(e => ({
      entityId: e.entityId,
      entityName: e.entityName,
      entityType: e.entityType,
      status: e.status,
      parentEntityId: e.parentEntityId || undefined,
      parentEntityType: e.parentEntityType || undefined,
    }));
  }

  /**
   * Get entity name by ID (for display purposes)
   */
  async getEntityName(
    customerId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<string | null> {
    const entity = await this.getEntity(customerId, entityType, entityId);
    return entity?.entityName || null;
  }

  /**
   * Upsert entity into cache
   */
  async upsertEntity(
    accountId: string,
    customerId: string,
    entity: EntityInfo
  ): Promise<void> {
    await prisma.entityHierarchy.upsert({
      where: {
        customerId_entityType_entityId: {
          customerId,
          entityType: entity.entityType,
          entityId: entity.entityId,
        },
      },
      create: {
        customerId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        entityName: entity.entityName,
        status: entity.status,
        parentEntityType: entity.parentEntityType,
        parentEntityId: entity.parentEntityId,
        accountId,
      },
      update: {
        entityName: entity.entityName,
        status: entity.status,
        parentEntityType: entity.parentEntityType,
        parentEntityId: entity.parentEntityId,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Batch upsert entities
   */
  async batchUpsertEntities(
    accountId: string,
    customerId: string,
    entities: EntityInfo[]
  ): Promise<{ upserted: number }> {
    let upserted = 0;

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      for (const entity of entities) {
        await tx.entityHierarchy.upsert({
          where: {
            customerId_entityType_entityId: {
              customerId,
              entityType: entity.entityType,
              entityId: entity.entityId,
            },
          },
          create: {
            customerId,
            entityType: entity.entityType,
            entityId: entity.entityId,
            entityName: entity.entityName,
            status: entity.status,
            parentEntityType: entity.parentEntityType,
            parentEntityId: entity.parentEntityId,
            accountId,
          },
          update: {
            entityName: entity.entityName,
            status: entity.status,
            parentEntityType: entity.parentEntityType,
            parentEntityId: entity.parentEntityId,
            lastUpdated: new Date(),
          },
        });
        upserted++;
      }
    });

    return { upserted };
  }

  /**
   * Get campaign hierarchy (campaign → ad groups → keywords)
   */
  async getCampaignHierarchy(
    customerId: string,
    campaignId: string
  ): Promise<{
    campaign: EntityInfo | null;
    adGroups: EntityInfo[];
    keywords: EntityInfo[];
  }> {
    const campaign = await this.getEntity(customerId, EntityType.CAMPAIGN, campaignId);

    const adGroups = await this.getEntities(customerId, EntityType.AD_GROUP, {
      parentEntityId: campaignId,
    });

    const adGroupIds = adGroups.map(ag => ag.entityId);

    const keywords = adGroupIds.length > 0
      ? await prisma.entityHierarchy.findMany({
          where: {
            customerId,
            entityType: EntityType.KEYWORD,
            parentEntityId: { in: adGroupIds },
          },
        }).then(kws => kws.map(k => ({
          entityId: k.entityId,
          entityName: k.entityName,
          entityType: k.entityType,
          status: k.status,
          parentEntityId: k.parentEntityId || undefined,
          parentEntityType: k.parentEntityType || undefined,
        })))
      : [];

    return { campaign, adGroups, keywords };
  }

  /**
   * Delete stale entities (e.g., removed campaigns)
   */
  async deleteRemovedEntities(
    customerId: string,
    entityType: EntityType,
    activeEntityIds: string[]
  ): Promise<number> {
    const result = await prisma.entityHierarchy.deleteMany({
      where: {
        customerId,
        entityType,
        entityId: { notIn: activeEntityIds },
      },
    });

    return result.count;
  }

  /**
   * Get entity counts by type
   */
  async getEntityCounts(customerId: string): Promise<Record<EntityType, number>> {
    const counts = await prisma.entityHierarchy.groupBy({
      by: ['entityType'],
      where: { customerId },
      _count: { entityId: true },
    });

    const result: Record<EntityType, number> = {
      [EntityType.ACCOUNT]: 0,
      [EntityType.CAMPAIGN]: 0,
      [EntityType.AD_GROUP]: 0,
      [EntityType.KEYWORD]: 0,
      [EntityType.AD]: 0,
    };

    for (const count of counts) {
      result[count.entityType] = count._count.entityId;
    }

    return result;
  }
}

// Export singleton instance
export const entityHierarchyService = new EntityHierarchyService();
