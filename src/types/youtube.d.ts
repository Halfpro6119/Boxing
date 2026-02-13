declare namespace YT {
  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (e: { target: YT.Player }) => void;
      onStateChange?: (e: { data: number }) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy?: () => void;
  }
}
