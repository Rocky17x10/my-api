import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

// MySQL/MariaDB errors a client can cause and fix. Anything else stays a generic 500
// (BaseExceptionFilter logs it; the response never contains SQL or a stack trace).
const CLIENT_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  ER_DUP_ENTRY: {
    status: HttpStatus.CONFLICT,
    message: 'A record with this value already exists (for example the same email or asset tag).',
  },
  ER_ROW_IS_REFERENCED_2: {
    status: HttpStatus.CONFLICT,
    message: 'This record is still used by other records (history, requests or tickets) and cannot be deleted.',
  },
  ER_NO_REFERENCED_ROW_2: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A referenced record does not exist.',
  },
  // e.g. PATCH {"name": null}: optional in the DTO, NOT NULL in the table.
  ER_BAD_NULL_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A required value is missing.',
  },
  ER_DATA_TOO_LONG: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A value is too long.',
  },
};

@Catch(QueryFailedError)
export class DatabaseErrorFilter extends BaseExceptionFilter {
  catch(error: QueryFailedError, host: ArgumentsHost): void {
    const code = (error.driverError as { code?: string } | undefined)?.code;
    const known = code ? CLIENT_ERRORS[code] : undefined;

    if (!known) {
      super.catch(error, host);
      return;
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(known.status)
      .json({
        statusCode: known.status,
        error: known.status === HttpStatus.CONFLICT ? 'Conflict' : 'Bad Request',
        message: known.message,
      });
  }
}
