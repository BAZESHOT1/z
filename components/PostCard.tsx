import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Heart, MessageSquare, Share2, MoreHorizontal, Edit3, Trash2, Eye, Send, X, Save, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '../app/themeContext';
import { getAvatarUrl, toggleLike, recordPostView, updatePost, deletePost, fetchComments, createComment } from '../app/api';

interface PostCardProps {
  post: any;
  currentUser?: any;
  t: any;
  onShare: (item: any) => void;
  onPostDeleted?: (postId: number) => void;
  onPostUpdated?: (updated: any) => void;
}

export default function PostCard({ post, currentUser, t, onShare, onPostDeleted, onPostUpdated }: PostCardProps) {
  const { colors } = useTheme();

  const [currentPost, setCurrentPost] = useState(post);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post._count?.likes || 0);
  const [viewsCount, setViewsCount] = useState(post.viewsCount || 0);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Edit / Delete dropdown & modals
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editMediaUrl, setEditMediaUrl] = useState(post.mediaUrl || '');
  const [submitting, setSubmitting] = useState(false);

  const isOwner = currentUser && (currentUser.id === post.authorId || currentUser.username === post.author?.username);
  const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'ROOT');

  useEffect(() => {
    recordPostView(post.id).then((res) => {
      if (res && res.viewsCount !== undefined) {
        setViewsCount(res.viewsCount);
      }
    }).catch(() => {});
  }, [post.id]);

  const handleLike = async () => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }

    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount(prev => prev + (nextState ? 1 : -1));

    try {
      const res = await toggleLike(post.id);
      if (res && res.count !== undefined) {
        setLikesCount(res.count);
        setIsLiked(res.liked);
      }
    } catch (e) {
      setIsLiked(!nextState);
      setLikesCount(prev => prev + (nextState ? -1 : 1));
    }
  };

  const handleToggleComments = async () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      try {
        const list = await fetchComments(post.id);
        setComments(list || []);
      } catch (e) {} finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async () => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const added = await createComment(post.id, commentText.trim());
      if (added) {
        setComments([added, ...comments]);
        setCommentText('');
      }
    } catch (e) {} finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSubmitting(true);
    try {
      const updated = await updatePost(post.id, editContent.trim(), editMediaUrl.trim() || undefined);
      if (updated) {
        setCurrentPost(updated);
        if (onPostUpdated) onPostUpdated(updated);
        setEditing(false);
        setMenuOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deletePost(post.id);
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
      setMenuOpen(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Animated.View entering={FadeIn} style={[styles.card, { backgroundColor: colors.postCardBg, borderColor: colors.cardBorder }]}>
      
      {/* Header */}
      <View style={styles.cardHeader}>
        <TouchableOpacity 
          style={styles.authorArea} 
          onPress={() => router.push(`/profile/${currentPost.author?.username}`)}
        >
          <Image source={{ uri: getAvatarUrl(currentPost.author?.username, currentPost.author?.avatar) }} style={styles.avatar} />
          <View>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {currentPost.author?.firstName || currentPost.author?.username}
              </Text>
              {currentPost.author?.role === 'ROOT' && (
                <View style={styles.rootRoleBadge}><Text style={styles.rootRoleBadgeText}>ROOT</Text></View>
              )}
            </View>
            <Text style={[styles.authorHandle, { color: colors.textSecondary }]}>
              @{currentPost.author?.username}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Date & Action Menu */}
        <View style={styles.headerRight}>
          <View style={styles.timeBadge}>
            <Clock size={12} color={colors.textSecondary} />
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatDate(currentPost.createdAt)}
            </Text>
          </View>

          {(isOwner || isAdmin) && (
            <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)} style={styles.menuBtn}>
              <MoreHorizontal size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Owner Dropdown Menu */}
      {menuOpen && (
        <View style={[styles.dropdownMenu, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <TouchableOpacity style={styles.dropdownOption} onPress={() => { setEditing(true); setMenuOpen(false); }}>
            <Edit3 size={16} color={colors.text} />
            <Text style={[styles.dropdownText, { color: colors.text }]}>Редактировать</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownOption} onPress={handleDelete}>
            <Trash2 size={16} color="#f85149" />
            <Text style={[styles.dropdownText, { color: '#f85149' }]}>Удалить пост</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Form Inline */}
      {editing ? (
        <View style={[styles.editBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <TextInput
            style={[styles.editInput, { color: colors.text }]}
            multiline
            value={editContent}
            onChangeText={setEditContent}
            placeholder="Текст поста..."
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={[styles.editInput, { color: colors.text, borderTopWidth: 1, borderTopColor: colors.inputBorder }]}
            value={editMediaUrl}
            onChangeText={setEditMediaUrl}
            placeholder="URL медиафайла..."
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.cardBorder }]} onPress={() => setEditing(false)}>
              <X size={16} color="#fff" />
              <Text style={styles.editBtnText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#238636' }]} onPress={handleSaveEdit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <>
                <Save size={16} color="#fff" />
                <Text style={styles.editBtnText}>Сохранить</Text>
              </>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Post Content */
        <View style={styles.contentArea}>
          <Text style={[styles.postText, { color: colors.text }]}>
            {currentPost.content}
          </Text>

          {currentPost.isEdited && (
            <Text style={[styles.editedBadge, { color: colors.textSecondary }]}>
              (изменено: {formatDate(currentPost.updatedAt)})
            </Text>
          )}

          {currentPost.mediaUrl && (
            <Image source={{ uri: currentPost.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
          )}
        </View>
      )}

      {/* Bottom Actions Bar */}
      <View style={[styles.actionsBar, { borderTopColor: colors.subtleBorder }]}>
        
        {/* Likes */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Heart size={18} color={isLiked ? '#ef4444' : colors.textSecondary} fill={isLiked ? '#ef4444' : 'transparent'} />
          <Text style={[styles.actionVal, { color: isLiked ? '#ef4444' : colors.textSecondary }]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        {/* Comments */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleComments}>
          <MessageSquare size={18} color={showComments ? colors.primary : colors.textSecondary} />
          <Text style={[styles.actionVal, { color: showComments ? colors.primary : colors.textSecondary }]}>
            {comments.length || currentPost._count?.comments || 0}
          </Text>
        </TouchableOpacity>

        {/* Views Count Indicator */}
        <View style={styles.actionBtn}>
          <Eye size={18} color={colors.textSecondary} />
          <Text style={[styles.actionVal, { color: colors.textSecondary }]}>
            {viewsCount}
          </Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity 
          style={[styles.actionBtn, { marginLeft: 'auto' }]} 
          onPress={() => onShare({
            title: `Пост от @${currentPost.author?.username}`,
            url: `https://z.net/posts/${currentPost.id}`,
            type: 'post'
          })}
        >
          <Share2 size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Expandable Comments Container */}
      {showComments && (
        <View style={[styles.commentsBox, { backgroundColor: colors.commentBg, borderColor: colors.cardBorder }]}>
          {currentUser ? (
            <View style={styles.addCommentRow}>
              <TextInput
                style={[styles.commentInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                placeholder="Написать комментарий..."
                placeholderTextColor={colors.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity style={[styles.sendCommentBtn, { backgroundColor: colors.primary }]} onPress={handleAddComment} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={14} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.loginToCommentBox} onPress={() => router.push('/auth/login')}>
              <Text style={[styles.loginToCommentText, { color: colors.primary }]}>Войдите, чтобы оставить комментарий</Text>
            </TouchableOpacity>
          )}

          {loadingComments ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : comments.length === 0 ? (
            <Text style={[styles.emptyComments, { color: colors.textSecondary }]}>Комментариев нет</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Image source={{ uri: getAvatarUrl(c.author?.username, c.author?.avatar) }} style={styles.commentAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.commentAuthorName, { color: colors.text }]}>
                    {c.author?.firstName || c.author?.username}
                  </Text>
                  <Text style={[styles.commentText, { color: colors.text }]}>{c.content}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  authorArea: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontWeight: '800', fontSize: 15 },
  rootRoleBadge: { backgroundColor: '#f85149', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rootRoleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  authorHandle: { fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 11 },
  menuBtn: { padding: 4 },
  dropdownMenu: { position: 'absolute', right: 16, top: 50, zIndex: 10, borderRadius: 12, borderWidth: 1, padding: 6, gap: 4, width: 160 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8 },
  dropdownText: { fontWeight: '700', fontSize: 13 },
  contentArea: { gap: 10, marginBottom: 14 },
  postText: { fontSize: 15, lineHeight: 22 },
  editedBadge: { fontSize: 11, fontStyle: 'italic' },
  mediaImage: { width: '100%', height: 280, borderRadius: 14, marginTop: 6 },
  actionsBar: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingTop: 12, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionVal: { fontSize: 13, fontWeight: '700' },
  editBox: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 14 },
  editInput: { padding: 8, fontSize: 14 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  commentsBox: { marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  addCommentRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, height: 36, borderRadius: 18, paddingHorizontal: 14, borderWidth: 1, fontSize: 13 },
  sendCommentBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  loginToCommentBox: { padding: 10, borderRadius: 10, alignItems: 'center' },
  loginToCommentText: { fontWeight: '700', fontSize: 13 },
  emptyComments: { textAlign: 'center', fontSize: 12, marginVertical: 6 },
  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentAuthorName: { fontWeight: '700', fontSize: 12 },
  commentText: { fontSize: 13, marginTop: 2 }
});