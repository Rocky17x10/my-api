
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    // Find the user by email
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // Ensure the user has a password hash
    if (!user.password) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // Compare the submitted password with the stored hash
    const isPasswordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // Create the JWT payload
    const payload = {
      sub: user.id,
      email: user.email,
    };

    // Generate and return the access token
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
