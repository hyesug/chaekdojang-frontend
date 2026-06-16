'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_BASE } from '../../lib/api';
import ProfileAvatar from '../../components/ProfileAvatar';

const API = API_BASE;

interface Message {
  id: number;
  senderId: number;
  senderNickname: string;
  senderProfileImage: string;
  content: string;
  createdAt: string;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

export default function ChatRoomPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [myId, setMyId] = useState<number | null>(null);
  const clientRef = useRef<Client | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/auth/login'); return; }

    // 내 정보 가져오기
    fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMyId(d.data?.id));

    // 책 정보 가져오기
    fetch(`${API}/api/books/${bookId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setBookTitle(d.data?.title || '채팅방'));

    // 채팅방 입장 + 이전 메시지 로드
    fetch(`${API}/api/chat/${bookId}/join`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    }).then(() =>
      fetch(`${API}/api/chat/${bookId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setMessages(d.data || []))
    );

    // WebSocket 연결
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        client.subscribe(`/topic/chat/${bookId}`, (msg) => {
          const newMsg: Message = JSON.parse(msg.body);
          setMessages(prev => [...prev, newMsg]);
        });
      },
    });
    client.activate();
    clientRef.current = client;

    return () => { client.deactivate(); };
  }, [bookId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || !clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/chat/${bookId}`,
      body: JSON.stringify({ content: trimmed }),
    });
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-screen bg-white max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800">←</button>
        <div>
          <p className="font-semibold text-sm">{bookTitle}</p>
          <p className="text-xs text-gray-400">책 채팅방</p>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => {
          const isMine = msg.senderId === myId;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMine && (
                <ProfileAvatar
                  src={msg.senderProfileImage}
                  name={msg.senderNickname}
                  size="xs"
                  className="w-8 h-8"
                />
              )}
              <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!isMine && <p className="text-xs text-gray-500">{msg.senderNickname}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.content}
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-white">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="메시지를 입력하세요..."
          rows={1}
          className="flex-1 resize-none border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="bg-blue-500 text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-40 hover:bg-blue-600 transition-colors"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
