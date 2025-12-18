'use client';

import { useState } from 'react';
import { Comment } from '@/types/comments';
import { usePermissions } from '@/contexts/PermissionsContext';
import CommentInput from './CommentInput';

interface CommentThreadProps {
  comment: Comment;
  replies?: Comment[];
  onReply?: (content: string, mentions: string[]) => void;
  onEdit?: (commentId: string, content: string, mentions: string[]) => void;
  onDelete?: (commentId: string) => void;
  level?: number;
}

export default function CommentThread({
  comment,
  replies = [],
  onReply,
  onEdit,
  onDelete,
  level = 0,
}: CommentThreadProps) {
  const { currentUser } = usePermissions();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthor = currentUser?.id === comment.author.id;
  const canEdit = isAuthor;
  const canDelete = isAuthor;

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const commentDate = new Date(date);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return commentDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: commentDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleReply = async (content: string, mentions: string[]) => {
    if (!onReply) return;

    setIsSubmitting(true);
    try {
      await onReply(content, mentions);
      setShowReplyInput(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (content: string, mentions: string[]) => {
    if (!onEdit) return;

    setIsSubmitting(true);
    try {
      await onEdit(comment.id, content, mentions);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;

    if (confirm('Are you sure you want to delete this comment?')) {
      onDelete(comment.id);
    }
  };

  // Highlight mentions in content
  const renderContent = (content: string) => {
    // Simple mention highlighting - in production, use proper parser
    const parts = content.split(/(@[\w\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="font-medium text-blue-600">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`${level > 0 ? 'ml-12' : ''}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-medium text-white">
          {comment.author.avatar ? (
            <img
              src={comment.author.avatar}
              alt={comment.author.name}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            getInitials(comment.author.name)
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900">{comment.author.name}</span>
            <span className="text-xs text-gray-400">{formatTimestamp(comment.createdAt)}</span>
            {comment.isEdited && (
              <span className="text-xs text-gray-400">(edited)</span>
            )}
          </div>

          {/* Comment Body */}
          {isEditing ? (
            <div className="mt-2">
              <CommentInput
                onSubmit={handleEdit}
                onCancel={() => setIsEditing(false)}
                placeholder="Edit your comment..."
                autoFocus
                isSubmitting={isSubmitting}
                initialValue={comment.content}
              />
            </div>
          ) : (
            <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
              {renderContent(comment.content)}
            </div>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="mt-2 flex items-center gap-4 text-xs">
              {onReply && (
                <button
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  className="font-medium text-gray-500 hover:text-gray-700"
                >
                  Reply
                </button>
              )}

              {canEdit && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="font-medium text-gray-500 hover:text-gray-700"
                >
                  Edit
                </button>
              )}

              {canDelete && onDelete && (
                <button
                  onClick={handleDelete}
                  className="font-medium text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}

              {replies.length > 0 && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="flex items-center gap-1 font-medium text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${showReplies ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>
          )}

          {/* Reply Input */}
          {showReplyInput && !isEditing && (
            <div className="mt-3">
              <CommentInput
                onSubmit={handleReply}
                onCancel={() => setShowReplyInput(false)}
                placeholder={`Reply to ${comment.author.name}...`}
                autoFocus
                isSubmitting={isSubmitting}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
