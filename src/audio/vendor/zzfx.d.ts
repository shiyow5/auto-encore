declare module "./vendor/zzfx.js" {
  function zzfx(...parameters: number[]): any;
  const ZZFX: {
    volume: number;
    sampleRate: number;
    audioContext: AudioContext;
    play: (...parameters: number[]) => any;
    playSamples: (
      sampleChannels: number[][],
      volumeScale?: number,
      rate?: number,
      pan?: number,
      loop?: boolean,
    ) => any;
    buildSamples: (
      volume?: number,
      randomness?: number,
      frequency?: number,
      attack?: number,
      sustain?: number,
      release?: number,
      shape?: number,
      shapeCurve?: number,
      slide?: number,
      deltaSlide?: number,
      pitchJump?: number,
      pitchJumpTime?: number,
      repeatTime?: number,
      noise?: number,
      modulation?: number,
      bitCrush?: number,
      delay?: number,
      sustainVolume?: number,
      decay?: number,
      tremolo?: number,
      filter?: number,
    ) => Float32Array;
  };
  export { zzfx, ZZFX };
}

declare module "./vendor/zzfxm.js" {
  function zzfxM(
    instruments: number[][],
    patterns: number[][][],
    sequence: number[],
    BPM?: number,
    zzfxR?: number,
    zzfxG?: Function,
  ): [number[], number[]];
  export { zzfxM };
}
