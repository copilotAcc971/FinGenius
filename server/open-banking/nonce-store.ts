class NonceStore {
  private usedNonces = new Map<string, number>(); // nonce -> expiryTimestamp
  
  isNonceUsed(nonce: string): boolean {
    this.cleanup();
    return this.usedNonces.has(nonce);
  }
  
  markNonceAsUsed(nonce: string, ttlMinutes = 15): void {
    const expiryTime = Date.now() + (ttlMinutes * 60 * 1000);
    this.usedNonces.set(nonce, expiryTime);
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [nonce, expiry] of this.usedNonces.entries()) {
      if (expiry < now) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}

export const nonceStore = new NonceStore();
