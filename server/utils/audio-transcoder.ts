/**
 * Audio Transcoding Utilities
 * 
 * Handles conversion between PCM and G.711 Mu-Law (PCMU).
 * Used for interfacing with Twilio Media Streams.
 */

// G.711 Mu-Law Constants
const BIAS = 0x84;
const CLIP = 32635;

// Mu-Law decoding table (generated)
const muLawToPcmMap = new Int16Array(256);

// Initialize decoding table
for (let i = 0; i < 256; i++) {
  let mu = ~i;
  let sign = (mu & 0x80) ? -1 : 1;
  let exponent = (mu >> 4) & 0x07;
  let mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + BIAS) << exponent;
  sample -= BIAS;
  muLawToPcmMap[i] = (sign * sample);
}

/**
 * Decode Mu-Law 8-bit to PCM 16-bit
 */
export function decodeMuLaw(buffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(buffer.length * 2);
  for (let i = 0; i < buffer.length; i++) {
    const sample = muLawToPcmMap[buffer[i]];
    pcmBuffer.writeInt16LE(sample, i * 2);
  }
  return pcmBuffer;
}

/**
 * Encode PCM 16-bit to Mu-Law 8-bit
 */
export function encodeMuLaw(buffer: Buffer): Buffer {
  const muBuffer = Buffer.alloc(buffer.length / 2);
  
  for (let i = 0; i < muBuffer.length; i++) {
    let sample = buffer.readInt16LE(i * 2);
    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample = sample + BIAS;
    
    let exponent = 7;
    // Exponent calculation
    const mask = [0x4000, 0x2000, 0x1000, 0x800, 0x400, 0x200, 0x100, 0x80];
    for (let e = 0; e < 8; e++) {
       if (sample & mask[e]) {
         exponent = 7 - e;
         break;
       }
       if (e === 7 && exponent === 7) exponent = 0; // Fallback
    }

    let mantissa = (sample >> (exponent + 3)) & 0x0F;
    let byte = ~(sign | (exponent << 4) | mantissa);
    muBuffer[i] = byte;
  }
  
  return muBuffer;
}

/**
 * Simple Resampler: Upsample 8kHz to 16kHz (Linear Interpolation)
 */
export function resample8kTo16k(buffer: Buffer): Buffer {
  const output = Buffer.alloc(buffer.length * 2);
  // Simple duplication (Zero Order Hold) - fast and usually sufficient for speech upsampling for LLM
  // Or Linear Interpolation for slightly better quality
  for (let i = 0; i < buffer.length / 2; i++) {
    const sample = buffer.readInt16LE(i * 2);
    output.writeInt16LE(sample, i * 4);
    output.writeInt16LE(sample, i * 4 + 2);
  }
  return output;
}

/**
 * Simple Resampler: Downsample 24kHz to 8kHz (Decimation)
 * Assumes Input is PCM 16-bit 24kHz
 */
export function resample24kTo8k(buffer: Buffer): Buffer {
   // 24k -> 8k is factor of 3
   const outputLength = Math.floor(buffer.length / 2 / 3) * 2;
   const output = Buffer.alloc(outputLength);
   
   for (let i = 0; i < outputLength / 2; i++) {
     // Pick every 3rd sample
     const offset = i * 3 * 2;
     if (offset < buffer.length - 1) {
       const sample = buffer.readInt16LE(offset);
       output.writeInt16LE(sample, i * 2);
     }
   }
   return output;
}
