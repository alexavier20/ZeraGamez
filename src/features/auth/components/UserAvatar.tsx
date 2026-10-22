import { useState } from 'react';

interface UserAvatarProps {
  readonly avatarUrl: string | null;
  readonly className: string;
  readonly initials: string;
  readonly name: string;
}

export function UserAvatar({ avatarUrl, className, initials, name }: UserAvatarProps) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const showImage = avatarUrl !== null && failedAvatarUrl !== avatarUrl;

  return (
    <span
      aria-label={`Avatar de ${name}`}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-avatar-start to-avatar-end text-sm font-bold text-white ${className}`}
      role="img"
    >
      {showImage ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => {
            setFailedAvatarUrl(avatarUrl);
          }}
          src={avatarUrl}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
