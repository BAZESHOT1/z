import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  SafeAreaView,
  StatusBar,
  Dimensions,
  FlatList,
} from 'react-native';

const { width } = Dimensions.get('window');

interface Post {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  timeAgo: string;
}

interface Story {
  id: string;
  name: string;
  avatar: string;
  hasUnread: boolean;
}

const INITIAL_STORIES: Story[] = [
  { id: '1', name: 'Моя история', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', hasUnread: false },
  { id: '2', name: 'Максим', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', hasUnread: true },
  { id: '3', name: 'Елена', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', hasUnread: true },
  { id: '4', name: 'Артём', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', hasUnread: true },
  { id: '5', name: 'София', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', hasUnread: false },
];

const INITIAL_POSTS: Post[] = [
  {
    id: '1',
    author: {
      name: 'Алексей Смирнов',
      username: 'alex_dev',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    },
    content: '🚀 Запустили новый проект социальной сети на Docker + React Native + Express! Код чистый, микросервисная архитектура полностью готова.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    likes: 42,
    comments: 8,
    isLiked: false,
    timeAgo: '15 минут назад',
  },
  {
    id: '2',
    author: {
      name: 'Екатерина Иванова',
      username: 'katya_design',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    content: 'Утренний кофе и прототипирование нового интерфейса. Какой градиент вам нравится больше?',
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800',
    likes: 128,
    comments: 24,
    isLiked: true,
    timeAgo: '2 часа назад',
  },
];

export default function SocialApp() {
  const [activeTab, setActiveTab] = useState<'feed' | 'search' | 'messages' | 'profile'>('feed');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState('');

  const toggleLike = (postId: string) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          };
        }
        return post;
      })
    );
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;

    const newPost: Post = {
      id: Date.now().toString(),
      author: {
        name: 'Вы',
        username: 'user_active',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
      content: newPostContent,
      image: newPostImage.trim() || undefined,
      likes: 0,
      comments: 0,
      isLiked: false,
      timeAgo: 'Только что',
    };

    setPosts([newPost, ...posts]);
    setNewPostContent('');
    setNewPostImage('');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>SocialNet</Text>
        <TouchableOpacity style={styles.createPostBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.createPostBtnText}>+ Пост</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {activeTab === 'feed' && (
        <ScrollView style={styles.feedScroll} showsVerticalScrollIndicator={false}>
          {/* Stories Reel */}
          <View style={styles.storiesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesContent}>
              {INITIAL_STORIES.map((story) => (
                <View key={story.id} style={styles.storyItem}>
                  <View style={[styles.avatarRing, story.hasUnread && styles.unreadRing]}>
                    <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>
                    {story.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Posts List */}
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              {/* Author Info */}
              <View style={styles.postHeader}>
                <Image source={{ uri: post.author.avatar }} style={styles.authorAvatar} />
                <View style={styles.postHeaderInfo}>
                  <Text style={styles.authorName}>{post.author.name}</Text>
                  <Text style={styles.postTime}>@{post.author.username} • {post.timeAgo}</Text>
                </View>
              </View>

              {/* Content */}
              <Text style={styles.postText}>{post.content}</Text>

              {/* Image attachment */}
              {post.image && (
                <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
              )}

              {/* Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Text style={[styles.actionIcon, post.isLiked && styles.likedIcon]}>
                    {post.isLiked ? '❤️' : '🤍'}
                  </Text>
                  <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                    {post.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionText}>{post.comments}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>🔄</Text>
                  <Text style={styles.actionText}>Поделиться</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {activeTab === 'search' && (
        <View style={styles.centerTab}>
          <Text style={styles.centerTitle}>🔍 Поиск и Тренды</Text>
          <Text style={styles.centerSub}>Раздел исследований сообществ и хэштегов</Text>
        </View>
      )}

      {activeTab === 'messages' && (
        <View style={styles.centerTab}>
          <Text style={styles.centerTitle}>💬 Личные Сообщения</Text>
          <Text style={styles.centerSub}>Здесь отображаются чаты в реальном времени</Text>
        </View>
      )}

      {activeTab === 'profile' && (
        <ScrollView style={styles.feedScroll}>
          <View style={styles.profileHeader}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300' }}
              style={styles.profileAvatar}
            />
            <Text style={styles.profileTitle}>Алексей Разработчик</Text>
            <Text style={styles.profileBio}>Full-Stack Developer • React Native & Node.js</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>128</Text>
                <Text style={styles.statLabel}>Постов</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>1.4K</Text>
                <Text style={styles.statLabel}>Подписчиков</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>350</Text>
                <Text style={styles.statLabel}>Подписок</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('feed')}>
          <Text style={[styles.navIcon, activeTab === 'feed' && styles.navActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'feed' && styles.navLabelActive]}>Лента</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('search')}>
          <Text style={[styles.navIcon, activeTab === 'search' && styles.navActive]}>🔍</Text>
          <Text style={[styles.navLabel, activeTab === 'search' && styles.navLabelActive]}>Поиск</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('messages')}>
          <Text style={[styles.navIcon, activeTab === 'messages' && styles.navActive]}>💬</Text>
          <Text style={[styles.navLabel, activeTab === 'messages' && styles.navLabelActive]}>Чаты</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.navActive]}>👤</Text>
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>Профиль</Text>
        </TouchableOpacity>
      </View>

      {/* Create Post Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Новая публикация</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Что у вас нового?"
              multiline
              numberOfLines={4}
              value={newPostContent}
              onChangeText={setNewPostContent}
            />

            <TextInput
              style={styles.imageInput}
              placeholder="Ссылка на изображение (необязательно)"
              value={newPostImage}
              onChangeText={setNewPostImage}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={handleCreatePost}>
                <Text style={styles.submitBtnText}>Опубликовать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f5f8',
  },
  header: {
    height: 56,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#6366f1',
  },
  createPostBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createPostBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  feedScroll: {
    flex: 1,
  },
  storiesContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    marginBottom: 8,
  },
  storiesContent: {
    paddingHorizontal: 12,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 14,
    width: 68,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  unreadRing: {
    borderColor: '#6366f1',
  },
  storyAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  storyName: {
    fontSize: 11,
    marginTop: 4,
    color: '#374151',
  },
  postCard: {
    backgroundColor: '#ffffff',
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  postHeaderInfo: {
    justifyContent: 'center',
  },
  authorName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1f2937',
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  likedIcon: {
    transform: [{ scale: 1.1 }],
  },
  likedText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  centerTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  centerSub: {
    color: '#6b7280',
    textAlign: 'center',
  },
  profileHeader: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    padding: 24,
    marginBottom: 10,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  profileBio: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366f1',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  navBar: {
    height: 60,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  navActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    color: '#111827',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    height: 100,
    marginBottom: 12,
  },
  imageInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#f3f4f6',
  },
  cancelBtnText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});