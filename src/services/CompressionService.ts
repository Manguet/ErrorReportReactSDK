import { CompressionConfig, CompressionStats, ErrorReport } from '../types';

export class CompressionService {
  private config: CompressionConfig;
  private stats: CompressionStats = {
    totalCompressions: 0,
    totalDecompressions: 0,
    totalBytesSaved: 0,
    averageCompressionRatio: 0,
    compressionTime: 0
  };

  constructor(config?: Partial<CompressionConfig>) {
    this.config = {
      threshold: 1024, // 1KB
      level: 6,
      ...config
    };
  }

  configure(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isSupported(): boolean {
    // Check if compression is supported in the browser
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  }

  shouldCompress(data: ErrorReport | ErrorReport[]): boolean {
    try {
      const jsonString = JSON.stringify(data);
      const size = new TextEncoder().encode(jsonString).length;
      return size >= this.config.threshold;
    } catch {
      return false;
    }
  }

  async compress(data: ErrorReport | ErrorReport[]): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Compression not supported in this browser');
    }

    const startTime = performance.now();
    
    try {
      const jsonString = JSON.stringify(data);
      const originalBytes = new TextEncoder().encode(jsonString);
      
      // Use browser's CompressionStream if available
      const compressionStream = new CompressionStream('gzip');
      const writer = compressionStream.writable.getWriter();
      const reader = compressionStream.readable.getReader();
      
      // Write data
      await writer.write(originalBytes);
      await writer.close();
      
      // Read compressed data
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      // Combine chunks
      const compressedLength = chunks.reduce((len, chunk) => len + chunk.length, 0);
      const compressedBytes = new Uint8Array(compressedLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        compressedBytes.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Convert to base64
      const compressedBase64 = this.arrayBufferToBase64(compressedBytes.buffer);
      
      // Update stats
      const compressionTime = performance.now() - startTime;
      this.updateCompressionStats(originalBytes.length, compressedBytes.length, compressionTime);
      
      return compressedBase64;
    } catch (error) {
      console.error('Compression failed:', error);
      throw error;
    }
  }

  async decompress(compressedData: string): Promise<ErrorReport | ErrorReport[]> {
    if (!this.isSupported()) {
      throw new Error('Decompression not supported in this browser');
    }

    const startTime = performance.now();
    
    try {
      // Convert from base64
      const compressedBytes = this.base64ToArrayBuffer(compressedData);
      
      // Use browser's DecompressionStream
      const decompressionStream = new DecompressionStream('gzip');
      const writer = decompressionStream.writable.getWriter();
      const reader = decompressionStream.readable.getReader();
      
      // Write compressed data
      await writer.write(new Uint8Array(compressedBytes));
      await writer.close();
      
      // Read decompressed data
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      // Combine chunks and convert to string
      const decompressedLength = chunks.reduce((len, chunk) => len + chunk.length, 0);
      const decompressedBytes = new Uint8Array(decompressedLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        decompressedBytes.set(chunk, offset);
        offset += chunk.length;
      }
      
      const decompressedString = new TextDecoder().decode(decompressedBytes);
      
      // Update stats
      const decompressionTime = performance.now() - startTime;
      this.stats.totalDecompressions++;
      this.stats.compressionTime += decompressionTime;
      
      return JSON.parse(decompressedString);
    } catch (error) {
      console.error('Decompression failed:', error);
      throw error;
    }
  }

  // Fallback compression using simple string compression (not as efficient but more compatible)
  compressString(data: string): string {
    // Simple LZ-string style compression for compatibility
    const dict: Record<string, number> = {};
    const result: (string | number)[] = [];
    let dictIndex = 256;
    let current = '';
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const combined = current + char;
      
      if (dict[combined] !== undefined) {
        current = combined;
      } else {
        result.push(dict[current] !== undefined ? dict[current] : current);
        dict[combined] = dictIndex++;
        current = char;
      }
    }
    
    if (current !== '') {
      result.push(dict[current] !== undefined ? dict[current] : current);
    }
    
    return JSON.stringify(result);
  }

  getStats(): CompressionStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0,
      compressionTime: 0
    };
  }

  private updateCompressionStats(originalSize: number, compressedSize: number, compressionTime: number): void {
    this.stats.totalCompressions++;
    this.stats.totalBytesSaved += Math.max(0, originalSize - compressedSize);
    this.stats.compressionTime += compressionTime;
    
    // Update average compression ratio
    const ratio = compressedSize / originalSize;
    this.stats.averageCompressionRatio = 
      (this.stats.averageCompressionRatio * (this.stats.totalCompressions - 1) + ratio) / 
      this.stats.totalCompressions;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}