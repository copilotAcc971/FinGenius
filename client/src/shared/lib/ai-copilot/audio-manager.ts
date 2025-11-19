export class AudioManager {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private audioQueue: AudioBufferSourceNode[] = [];
  private isPlaying: boolean = false;

  async initialize(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });

      await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.workletNode);

      console.log('[AudioManager] Initialized successfully');
    } catch (error) {
      console.error('[AudioManager] Initialization failed:', error);
      throw error;
    }
  }

  onAudioData(callback: (audioData: ArrayBuffer) => void): void {
    if (!this.workletNode) {
      console.error('[AudioManager] Worklet node not initialized');
      return;
    }

    this.workletNode.port.onmessage = (event) => {
      if (event.data.audioData) {
        callback(event.data.audioData);
      }
    };
  }

  async playAudioResponse(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      console.error('[AudioManager] Audio context not initialized');
      return;
    }

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32Array.length,
        24000
      );
      
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.audioQueue.shift();
        if (this.audioQueue.length === 0) {
          this.isPlaying = false;
        }
      };

      this.audioQueue.push(source);

      if (!this.isPlaying) {
        this.isPlaying = true;
        source.start();
      }
    } catch (error) {
      console.error('[AudioManager] Error playing audio:', error);
    }
  }

  stopRecording(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.workletNode = null;
    this.audioQueue = [];
    this.isPlaying = false;

    console.log('[AudioManager] Stopped recording');
  }

  isInitialized(): boolean {
    return this.audioContext !== null && this.workletNode !== null;
  }
}
