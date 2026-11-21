import { IsIn } from 'class-validator';

export class ChangeRoleDto {
  @IsIn(['admin', 'user'], { message: 'Role must be either admin or user.' })
  role: 'admin' | 'user';
}
