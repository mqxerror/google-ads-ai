export interface Comment {
  id: string;
  entityType: 'campaign' | 'adGroup' | 'keyword' | 'ad';
  entityId: string;
  entityName?: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  content: string;
  mentions: string[]; // User IDs mentioned in the comment
  createdAt: Date;
  updatedAt?: Date;
  parentId?: string; // For threaded replies
  isEdited: boolean;
  reactions?: Reaction[];
}

export interface Reaction {
  emoji: string;
  users: string[]; // User IDs who reacted
}

export interface CommentThread {
  rootComment: Comment;
  replies: Comment[];
  totalReplies: number;
}

export interface CreateCommentRequest {
  entityType: Comment['entityType'];
  entityId: string;
  content: string;
  mentions?: string[];
  parentId?: string;
}

export interface UpdateCommentRequest {
  commentId: string;
  content: string;
  mentions?: string[];
}

export interface CommentFilter {
  entityType?: Comment['entityType'];
  entityId?: string;
  authorId?: string;
  hasReplies?: boolean;
}

export interface MentionSuggestion {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
