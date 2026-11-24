import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateAssetDto } from '../assets/dto/asset.dto';
import { UpdateUserDto } from '../users/update-user.dto';

const errors = (cls: new () => object, body: object) =>
  validateSync(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true }).map(
    (e) => e.property,
  );

// A non-strict MariaDB stores '' when a NOT NULL column gets NULL, so null must fail validation.
describe('PATCH DTOs: omitted is fine, null is not (NOT NULL columns)', () => {
  it('UpdateAssetDto', () => {
    expect(errors(UpdateAssetDto, {})).toEqual([]);
    expect(errors(UpdateAssetDto, { location: 'Desk 7' })).toEqual([]);
    expect(errors(UpdateAssetDto, { brand: null, notes: null })).toEqual([]);
    expect(errors(UpdateAssetDto, { name: null })).toEqual(['name']);
    expect(errors(UpdateAssetDto, { assetTag: null, category: null })).toEqual([
      'assetTag',
      'category',
    ]);
    expect(errors(UpdateAssetDto, { name: '' })).toEqual(['name']);
  });

  it('UpdateUserDto', () => {
    expect(errors(UpdateUserDto, { department: null })).toEqual([]);
    expect(errors(UpdateUserDto, { name: null })).toEqual(['name']);
    expect(errors(UpdateUserDto, { email: null })).toEqual(['email']);
    expect(errors(UpdateUserDto, { password: 'a-new-password-1' })).toEqual(['password']);
  });
});
