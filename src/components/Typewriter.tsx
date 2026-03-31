import { useState, useEffect } from 'react';

export default function Typewriter({ text, speed = 40, onComplete }: { text: string, speed?: number, onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className="relative">
      {displayedText}
      <span className="animate-pulse ml-1 inline-block w-2 h-5 bg-white align-middle"></span>
    </span>
  );
}
