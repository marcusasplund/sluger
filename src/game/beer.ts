// Movement remains under player control throughout this window, even at the centre.
export const BEER_ESCAPE_SECONDS = 2.4;
export type BeerStage = 'clear' | 'lured' | 'danger' | 'recovering';
export class BeerEscape {
  exposure = 0;
  stage: BeerStage = 'clear';
  reset() { this.exposure = 0; this.stage = 'clear'; }
  step(dt: number, range: number, radius: number) {
    if (range < radius) {
      this.exposure = Math.min(BEER_ESCAPE_SECONDS, this.exposure + dt);
      this.stage = 'danger';
    } else {
      this.exposure = Math.max(0, this.exposure - dt * 1.8);
      this.stage = this.exposure > 0 ? 'recovering' : range < radius + .85 ? 'lured' : 'clear';
    }
    return this.exposure >= BEER_ESCAPE_SECONDS && range < .62;
  }
  get remaining() { return Math.max(0, BEER_ESCAPE_SECONDS - this.exposure); }
}
