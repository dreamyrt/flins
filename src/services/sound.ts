export type SoundPreset = 'kalimba' | 'harp' | 'typewriter' | 'zen' | 'celesta' | 'silent';

class CozySoundService {
  private ctx: AudioContext | null = null;
  private currentPreset: SoundPreset = 'kalimba';

  constructor() {
    if (typeof window !== 'undefined') {
      // Автоматичне перемикання частоти при підключенні AirPods / зміні аудіовиходу
      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          this.resetContext();
        });
      }

      const unlock = () => {
        this.getContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  private resetContext() {
    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
  }

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  setPreset(preset: SoundPreset) {
    this.currentPreset = preset;
  }

  getPreset(): SoundPreset {
    return this.currentPreset;
  }

  playHoverChime() {
    if (this.currentPreset === 'silent') return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    try {
      switch (this.currentPreset) {
        case 'kalimba': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.09, t + 0.015);
          gain.gain.linearRampToValueAtTime(0.0001, t + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.23);
          break;
        }
        case 'harp': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
          gain.gain.linearRampToValueAtTime(0.0001, t + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.26);
          break;
        }
        case 'typewriter': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.06, t + 0.008);
          gain.gain.linearRampToValueAtTime(0.0001, t + 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.08);
          break;
        }
        case 'zen': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
          gain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.36);
          break;
        }
        case 'celesta':
        default: {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
          gain.gain.linearRampToValueAtTime(0.0001, t + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.23);
          break;
        }
      }
    } catch {}
  }

  playClickChime() {
    if (this.currentPreset === 'silent') return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const playTone = (freq: number, delay: number, dur: number, vol: number, wave: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t + delay);
      gain.gain.setValueAtTime(0.001, t + delay);
      gain.gain.linearRampToValueAtTime(vol, t + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, t + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.01);
    };

    try {
      switch (this.currentPreset) {
        case 'kalimba': {
          playTone(523.25, 0, 0.3, 0.11, 'triangle');
          playTone(783.99, 0.08, 0.38, 0.09, 'triangle');
          break;
        }
        case 'harp': {
          playTone(587.33, 0, 0.32, 0.09, 'sine');
          playTone(739.99, 0.06, 0.35, 0.08, 'sine');
          playTone(880.0, 0.12, 0.42, 0.07, 'sine');
          break;
        }
        case 'typewriter': {
          playTone(320, 0, 0.06, 0.1, 'triangle');
          playTone(1760, 0.07, 0.28, 0.06, 'sine');
          break;
        }
        case 'zen': {
          playTone(330, 0, 0.55, 0.1, 'sine');
          playTone(660, 0.02, 0.45, 0.05, 'sine');
          break;
        }
        case 'celesta':
        default: {
          playTone(987.77, 0, 0.32, 0.09, 'sine');
          playTone(1318.51, 0.08, 0.4, 0.07, 'sine');
          break;
        }
      }
    } catch {}
  }

  previewPreset(preset: SoundPreset) {
    const prev = this.currentPreset;
    this.currentPreset = preset;
    this.playClickChime();
    this.currentPreset = prev;
  }
}

export const cozySound = new CozySoundService();
