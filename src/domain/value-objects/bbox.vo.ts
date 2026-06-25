import { ValidationError } from '../errors/validation.error.js';

export class BoundingBox {
  private constructor(
    private readonly _minLon: number,
    private readonly _minLat: number,
    private readonly _maxLon: number,
    private readonly _maxLat: number,
  ) {}

  static create(minLon: number, minLat: number, maxLon: number, maxLat: number): BoundingBox {
    if (minLon > maxLon) {
      throw new ValidationError('minLon must be less than or equal to maxLon');
    }
    if (minLat > maxLat) {
      throw new ValidationError('minLat must be less than or equal to maxLat');
    }
    return new BoundingBox(minLon, minLat, maxLon, maxLat);
  }

  get minLon(): number { return this._minLon; }
  get minLat(): number { return this._minLat; }
  get maxLon(): number { return this._maxLon; }
  get maxLat(): number { return this._maxLat; }

  toArray(): [number, number, number, number] {
    return [this._minLon, this._minLat, this._maxLon, this._maxLat];
  }

  equals(other: BoundingBox): boolean {
    return (
      this._minLon === other._minLon &&
      this._minLat === other._minLat &&
      this._maxLon === other._maxLon &&
      this._maxLat === other._maxLat
    );
  }
}
