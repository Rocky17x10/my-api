
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
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AssetRequestsService {
  constructor(
    @InjectRepository(AssetRequest)
    private readonly requestRepository: Repository<AssetRequest>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationsService: NotificationsService,

    private readonly activityLogsService: ActivityLogsService,
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

    // Record asset request creation.
    await this.activityLogsService.createLog({
      actorId: user.id,
      action: 'ASSET_REQUEST_CREATED',
      entityType: 'asset_request',
      entityId: saved.id,
      description: `${user.name} submitted an asset request for ${itemName}.`,
      metadata: {
        requestId: saved.id,
        itemName,
        category,
        reason,
        status: saved.status,
        requestedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
    });

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

    const previousStatus = request.status;

    request.status = status as AssetRequestStatus;
    request.reviewedBy = reviewer;
    request.adminNote = adminNote?.trim() || null;

    await this.requestRepository.save(request);

    const isApproved = status === AssetRequestStatus.APPROVED;

    const decision = isApproved ? 'approved' : 'rejected';

    // Record the approval or rejection activity.
    await this.activityLogsService.createLog({
      actorId: reviewer.id,
      action: isApproved
        ? 'ASSET_REQUEST_APPROVED'
        : 'ASSET_REQUEST_REJECTED',
      entityType: 'asset_request',
      entityId: request.id,
      description: `${reviewer.name} ${decision} the asset request for ${request.itemName} submitted by ${request.requestedBy.name}.`,
      metadata: {
        requestId: request.id,
        itemName: request.itemName,
        category: request.category,
        previousStatus,
        newStatus: request.status,
        adminNote: request.adminNote,
        requestedBy: {
          id: request.requestedBy.id,
          name: request.requestedBy.name,
        },
        reviewedBy: {
          id: reviewer.id,
          name: reviewer.name,
        },
      },
    });

    // Notify the employee who submitted the request.
    const title = isApproved
      ? 'Asset Request Approved'
      : 'Asset Request Rejected';

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
      request.id,
    );

    return this.requestRepository.findOne({
      where: { id: requestId },
      relations: { requestedBy: true, reviewedBy: true },
    });
  }
}
