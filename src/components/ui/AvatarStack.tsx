import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export interface InterestedUser {
  id: string;
  name: string;
  photoURL?: string;
  chatId: string;
}

interface AvatarStackProps {
  users: InterestedUser[];
  max?: number;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({ users, max = 5 }) => {
  if (!users || users.length === 0) return null;

  const displayUsers = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-2 overflow-hidden py-1">
      {displayUsers.map((user) => (
        <Link 
          key={user.id} 
          href={`/chat/${user.chatId}`}
          className="relative inline-block h-8 w-8 rounded-full ring-2 ring-white hover:scale-110 hover:z-10 transition-transform duration-200 cursor-pointer group"
          title={`Chat con ${user.name}`}
        >
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={user.name}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="h-full w-full rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Tooltip simple */}
          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
            {user.name}
          </span>
        </Link>
      ))}
      
      {remaining > 0 && (
        <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white text-xs font-medium text-gray-500 hover:bg-gray-200 cursor-pointer z-0">
          +{remaining}
        </div>
      )}
    </div>
  );
};
