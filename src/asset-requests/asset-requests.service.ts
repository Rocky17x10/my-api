
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AssetRequest,
  AssetRequestStatus,
} from './asset-request.entity';

import { User } from '../users/user.entity';
import { NotificationsService } from '../support-tickets/notifications/notifications.service';

@Injectable()
export class AssetRequestsService {
  constructor(
    @InjectRepository(AssetRequest)
    private readonly requestRepository: Repository<AssetRequest>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationsService: NotificationsService,
  ) {}

  // Create a new asset request and notify all administrators.
  async create(
    userId: number,
    data: { itemName: string; category: string; reason: string },
  ) {
    const itemName = data.itemName?.trim();
    const category = data.category?.trim();
    const reason = data.reason?.trim();

    if (!itemName || !category || !reason) {
      throw new BadRequestException(
        'Item name, category and reason are required.',
      );
    }

    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const request = this.requestRepository.create({
      requestedBy: user,
      itemName,
      category,
      reason,
      status: AssetRequestStatus.PENDING,
    });

    const saved = await this.requestRepository.save(request);

    // Find all Admin and Super Admin accounts.
    const administrators = await this.userRepository.find({
      where: [
        { role: 'admin' },
        { role: 'super_admin' },
      ],
    });

    // Notify every administrator except the requester.
    await Promise.all(
      administrators
        .filter((admin) => admin.id !== user.id)
        .map((admin) =>
          this.notificationsService.createNotification(
            admin.id,
            'New Asset Request',
            `${user.name} submitted a request for ${itemName}.`,
            'asset_request_new',
            saved.id,
          ),
        ),
    );

    return this.requestRepository.findOne({
      where: { id: saved.id },
      relations: { requestedBy: true, reviewedBy: true },
    });
  }

  // Get requests submitted by the logged-in employee.
  async findMyRequests(userId: number) {
    return this.requestRepository.find({
      where: { requestedBy: { id: userId } },
      relations: { requestedBy: true, reviewedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Get all asset requests.
  async findAll() {
    return this.requestRepository.find({
      relations: { requestedBy: true, reviewedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Approve or reject an asset request.
  async review(
    requestId: number,
    reviewerId: number,
    status: string,
    adminNote?: string,
  ) {
    if (
      status !== AssetRequestStatus.APPROVED &&
      status !== AssetRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Status must be approved or rejected.',
      );
    }

    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: { requestedBy: true, reviewedBy: true },
    });

    if (!request) {
      throw new NotFoundException('Asset request not found.');
    }

    if (request.status !== AssetRequestStatus.PENDING) {
      throw new BadRequestException(
        'This request has already been reviewed.',
      );
    }

    const reviewer = await this.userRepository.findOneBy({
      id: reviewerId,
    });

    if (!reviewer) {
      throw new NotFoundException('Reviewing user not found.');
    }

    request.status = status as AssetRequestStatus;
    request.reviewedBy = reviewer;
    request.adminNote = adminNote?.trim() || null;

    await this.requestRepository.save(request);

    // Notify the employee who submitted the request.
    const isApproved = status === AssetRequestStatus.APPROVED;

    const title = isApproved
      ? 'Asset Request Approved'
      : 'Asset Request Rejected';

    const decision = isApproved ? 'approved' : 'rejected';

    let message = `Your request for ${request.itemName} has been ${decision}.`;

    if (request.adminNote) {
      message += ` Admin note: ${request.adminNote}`;
    }

    await this.notificationsService.createNotification(
      request.requestedBy.id,
      title,
      message,
      isApproved
        ? 'asset_request_approved'
        : 'asset_request_rejected',
    );

    return this.requestRepository.findOne({
      where: { id: requestId },
      relations: { requestedBy: true, reviewedBy: true },
    });
  }
}
