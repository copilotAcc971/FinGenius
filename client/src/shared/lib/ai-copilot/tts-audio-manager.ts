export interface AudioQueueItem {
  id: string;
  audioData: string;
  transcript: string;
  status: 'pending' | 'playing' | 'completed';
}

export class TTSAudioManager {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private audioQueue: AudioQueueItem[] = [];
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private currentQueueIndex: number = -1;
  
  public onPlaybackStateChange: ((state: { isPlaying: boolean; isPaused: boolean; currentIndex: number }) => void) | null = null;
  public onQueueUpdate: ((queue: AudioQueueItem[]) => void) | null = null;

  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      console.log('[TTSAudioManager] Initialized successfully');
    } catch (error) {
      console.error('[TTSAudioManager] Initialization failed:', error);
      throw error;
    }
  }

  addToQueue(id: string, audioData: string, transcript: string): void {
    const item: AudioQueueItem = {
      id,
      audioData,
      transcript,
      status: 'pending'
    };
    
    this.audioQueue.push(item);
    
    if (this.onQueueUpdate) {
      this.onQueueUpdate([...this.audioQueue]);
    }

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  async playAudio(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      console.error('[TTSAudioManager] Audio context not initialized');
      return;
    }

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      this.currentSource = source;

      return new Promise((resolve) => {
        source.onended = () => {
          this.currentSource = null;
          resolve();
        };

        source.start();
      });
    } catch (error) {
      console.error('[TTSAudioManager] Error playing audio:', error);
      throw error;
    }
  }

  async playNext(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.currentQueueIndex = -1;
      this.notifyPlaybackStateChange();
      return;
    }

    const nextIndex = this.currentQueueIndex + 1;
    if (nextIndex >= this.audioQueue.length) {
      this.isPlaying = false;
      this.currentQueueIndex = -1;
      this.notifyPlaybackStateChange();
      return;
    }

    this.currentQueueIndex = nextIndex;
    const item = this.audioQueue[nextIndex];
    item.status = 'playing';
    
    this.isPlaying = true;
    this.isPaused = false;
    this.notifyPlaybackStateChange();
    
    if (this.onQueueUpdate) {
      this.onQueueUpdate([...this.audioQueue]);
    }

    try {
      await this.playAudio(item.audioData);
      
      item.status = 'completed';
      if (this.onQueueUpdate) {
        this.onQueueUpdate([...this.audioQueue]);
      }

      await this.playNext();
    } catch (error) {
      console.error('[TTSAudioManager] Error playing queue item:', error);
      item.status = 'completed';
      if (this.onQueueUpdate) {
        this.onQueueUpdate([...this.audioQueue]);
      }
      await this.playNext();
    }
  }

  pause(): void {
    if (this.currentSource && this.audioContext && this.isPlaying && !this.isPaused) {
      this.audioContext.suspend();
      this.isPaused = true;
      this.notifyPlaybackStateChange();
    }
  }

  resume(): void {
    if (this.audioContext && this.isPlaying && this.isPaused) {
      this.audioContext.resume();
      this.isPaused = false;
      this.notifyPlaybackStateChange();
    }
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }

    this.isPlaying = false;
    this.isPaused = false;
    this.currentQueueIndex = -1;
    this.audioQueue = [];
    
    this.notifyPlaybackStateChange();
    if (this.onQueueUpdate) {
      this.onQueueUpdate([]);
    }
  }

  clearQueue(): void {
    this.stop();
  }

  getQueue(): AudioQueueItem[] {
    return [...this.audioQueue];
  }

  getCurrentIndex(): number {
    return this.currentQueueIndex;
  }

  getPlaybackState(): { isPlaying: boolean; isPaused: boolean; currentIndex: number } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentIndex: this.currentQueueIndex
    };
  }

  private notifyPlaybackStateChange(): void {
    if (this.onPlaybackStateChange) {
      this.onPlaybackStateChange(this.getPlaybackState());
    }
  }

  cleanup(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('[TTSAudioManager] Cleaned up');
  }

  isInitialized(): boolean {
    return this.audioContext !== null;
  }
}
