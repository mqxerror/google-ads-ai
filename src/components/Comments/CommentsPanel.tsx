'use client';

import { useState, useEffect } from 'react';
import { Comment, CommentThread as CommentThreadType, CreateCommentRequest } from '@/types/comments';
import { usePermissions } from '@/contexts/PermissionsContext';
import CommentThread from './CommentThread';
import CommentInput from './CommentInput';

interface CommentsPanelProps {
  entityType: 'campaign' | 'adGroup' | 'keyword' | 'ad';
  entityId: string;
  entityName?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Mock comments data for demo
const MOCK_COMMENTS: Comment[] = [
  {
    id: '1',
    entityType: 'campaign',
    entityId: '123',
    author: {
      id: '1',
      name: 'Admin User',
      email: 'admin@company.com',
    },
    content: 'This campaign is performing well. Let\'s increase the budget by 20%.',
    mentions: [],
    createdAt: new Date('2024-12-10T10:00:00'),
    isEdited: false,
  },
  {
    id: '2',
    entityType: 'campaign',
    entityId: '123',
    author: {
      id: '2',
      name: 'Marketing Manager',
      email: 'manager@company.com',
    },
    content: '@Admin User Agreed! I\'ll prepare the budget increase request.',
    mentions: ['1'],
    createdAt: new Date('2024-12-10T11:30:00'),
    parentId: '1',
    isEdited: false,
  },
  {
    id: '3',
    entityType: 'campaign',
    entityId: '123',
    author: {
      id: '3',
      name: 'Data Analyst',
      email: 'analyst@company.com',
    },
    content: 'CPA is trending upward. We should monitor keyword performance closely.',
    mentions: [],
    createdAt: new Date('2024-12-11T09:15:00'),
    isEdited: false,
  },
  {
    id: '4',
    entityType: 'campaign',
    entityId: '123',
    author: {
      id: '1',
      name: 'Admin User',
      email: 'admin@company.com',
    },
    content: 'Good catch @Data Analyst. Let\'s review the keywords tomorrow.',
    mentions: ['3'],
    createdAt: new Date('2024-12-11T14:20:00'),
    parentId: '3',
    isEdited: false,
  },
];

export default function CommentsPanel({
  entityType,
  entityId,
  entityName,
  isOpen,
  onClose,
}: CommentsPanelProps) {
  const { currentUser } = usePermissions();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mentions'>('all');

  useEffect(() => {
    if (!isOpen) return;
    loadComments();
  }, [isOpen, entityType, entityId]);

  const loadComments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In real implementation, fetch from API
      await new Promise(resolve => setTimeout(resolve, 500));

      // Filter comments for this entity
      const entityComments = MOCK_COMMENTS.filter(
        c => c.entityType === entityType && c.entityId === entityId
      );

      setComments(entityComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (content: string, mentions: string[]) => {
    setIsSubmitting(true);
    try {
      // In real implementation, call API
      const newComment: Comment = {
        id: Date.now().toString(),
        entityType,
        entityId,
        entityName,
        author: {
          id: currentUser?.id || 'unknown',
          name: currentUser?.name || 'User',
          email: currentUser?.email || '',
          avatar: currentUser?.avatar,
        },
        content,
        mentions,
        createdAt: new Date(),
        isEdited: false,
      };

      setComments([...comments, newComment]);
    } catch (err) {
      console.error('Failed to add comment:', err);
      setError('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = (parentId: string) => {
    return async (content: string, mentions: string[]) => {
      setIsSubmitting(true);
      try {
        const newComment: Comment = {
          id: Date.now().toString(),
          entityType,
          entityId,
          entityName,
          author: {
            id: currentUser?.id || 'unknown',
            name: currentUser?.name || 'User',
            email: currentUser?.email || '',
            avatar: currentUser?.avatar,
          },
          content,
          mentions,
          createdAt: new Date(),
          parentId,
          isEdited: false,
        };

        setComments([...comments, newComment]);
      } catch (err) {
        console.error('Failed to reply:', err);
        setError('Failed to add reply');
      } finally {
        setIsSubmitting(false);
      }
    };
  };

  const handleEdit = async (commentId: string, content: string, mentions: string[]) => {
    try {
      setComments(comments.map(c =>
        c.id === commentId
          ? { ...c, content, mentions, isEdited: true, updatedAt: new Date() }
          : c
      ));
    } catch (err) {
      console.error('Failed to edit comment:', err);
      setError('Failed to edit comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      setComments(comments.filter(c => c.id !== commentId && c.parentId !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError('Failed to delete comment');
    }
  };

  // Organize comments into threads
  const commentThreads: CommentThreadType[] = comments
    .filter(c => !c.parentId)
    .map(rootComment => ({
      rootComment,
      replies: comments.filter(c => c.parentId === rootComment.id),
      totalReplies: comments.filter(c => c.parentId === rootComment.id).length,
    }));

  // Filter by mentions if needed
  const filteredThreads = filter === 'mentions'
    ? commentThreads.filter(thread =>
        thread.rootComment.mentions.includes(currentUser?.id || '') ||
        thread.replies.some(reply => reply.mentions.includes(currentUser?.id || ''))
      )
    : commentThreads;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
              {entityName && (
                <p className="mt-1 text-sm text-gray-500">
                  {entityType}: {entityName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All ({commentThreads.length})
            </button>
            <button
              onClick={() => setFilter('mentions')}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                filter === 'mentions'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Mentions
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Add Comment */}
          <div className="mb-6">
            <CommentInput
              onSubmit={handleAddComment}
              placeholder="Add a comment..."
              isSubmitting={isSubmitting}
            />
          </div>

          {/* Comments List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="rounded-lg bg-gray-50 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="mt-4 text-sm text-gray-500">
                {filter === 'mentions' ? 'No mentions yet' : 'No comments yet'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {filter === 'mentions' ? 'Comments mentioning you will appear here' : 'Be the first to comment'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredThreads.map((thread) => (
                <CommentThread
                  key={thread.rootComment.id}
                  comment={thread.rootComment}
                  replies={thread.replies}
                  onReply={handleReply(thread.rootComment.id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
