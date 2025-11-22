import React from 'react';

interface LiveRegionProps {
  message?: string;
  type?: 'status' | 'alert' | 'assertive';
  visible?: boolean;
}

export function LiveRegion({ message, type = 'status', visible = false }: LiveRegionProps) {
  const [displayMessage, setDisplayMessage] = React.useState(message);

  React.useEffect(() => {
    setDisplayMessage(message);
  }, [message]);

  const role = type === 'alert' ? 'alert' : type === 'assertive' ? 'alert' : 'status';
  const ariaLive = type === 'assertive' ? 'assertive' : 'polite';

  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      className={visible ? "text-sm text-foreground" : "sr-only"}
      data-testid="live-region"
    >
      {displayMessage}
    </div>
  );
}

export function useAnnounce() {
  const [message, setMessage] = React.useState('');
  const [type, setType] = React.useState<'status' | 'alert' | 'assertive'>('status');

  const announce = (msg: string, msgType: 'status' | 'alert' | 'assertive' = 'status') => {
    setMessage(msg);
    setType(msgType);
    setTimeout(() => setMessage(''), 3000);
  };

  const alertUser = (msg: string) => announce(msg, 'alert');
  const updateStatus = (msg: string) => announce(msg, 'status');

  return { message, type, announce, alertUser, updateStatus };
}
