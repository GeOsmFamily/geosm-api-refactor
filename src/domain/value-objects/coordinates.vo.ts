import { ValidationError } from '../errors/validation.error.js';

export class Coordinates {
  private readonly _longitude: number;
  private readonly _latitude: number;

  private constructor(longitude: number, latitude: number) {
    this._longitude = longitude;
    this._latitude = latitude;
  }

  static create(longitude: number, latitude: number): Coordinates {
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
    }
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
    }
    return new Coordinates(longitude, latitude);
  }

  get longitude(): number {
    return this._longitude;
  }

  get latitude(): number {
    return this._latitude;
  }

  toArray(): [number, number] {
    return [this._longitude, this._latitude];
  }

  equals(other: Coordinates): boolean {
    return this._longitude === other._longitude && this._latitude === other._latitude;
  }
}
