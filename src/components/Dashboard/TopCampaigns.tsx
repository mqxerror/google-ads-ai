'use client';

import { Campaign } from '@/types/campaign';
import TrendIndicator from './TrendIndicator';

interface TopCampaignsProps {
  campaigns: Campaign[];
  limit?: number;
  sortBy?: 'spend' | 'conversions' | 'clicks' | 'roas';
}

export default function TopCampaigns({
  campaigns,
  limit = 5,
  sortBy = 'spend',
}: TopCampaignsProps) {
  const sortedCampaigns = [...campaigns]
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, limit);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Top Campaigns by {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3">Campaign</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3 text-right">Spend</th>
              <th className="px-5 py-3 text-right">Conversions</th>
              <th className="px-5 py-3 text-right">CPA</th>
              <th className="px-5 py-3 text-right">ROAS</th>
              <th className="px-5 py-3 text-center">AI Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedCampaigns.map((campaign, index) => (
              <tr
                key={campaign.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {campaign.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {campaign.status}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {campaign.type}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm text-gray-900">
                  ${campaign.spend.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm text-gray-900">
                  {campaign.conversions.toLocaleString()}
                </td>
                <td className="px-5 py-4 text-right font-mono text-sm text-gray-900">
                  ${campaign.cpa.toFixed(2)}
                </td>
                <td className="px-5 py-4 text-right">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      campaign.roas >= 2
                        ? 'text-green-600'
                        : campaign.roas >= 1
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {campaign.roas.toFixed(2)}x
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                        campaign.aiScore >= 80
                          ? 'bg-green-100 text-green-700'
                          : campaign.aiScore >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : campaign.aiScore >= 40
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {campaign.aiScore}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {campaigns.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No campaigns to display
        </div>
      )}
    </div>
  );
}
