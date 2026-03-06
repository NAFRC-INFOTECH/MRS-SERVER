import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DutyRecord, DutyRecordDocument, Shift, DutyStatus } from './duty.schema';
import { UsersService } from '../users/users.service';
import { DepartmentsService } from '../departments/departments.service';

type CreateDutyDto = {
  role: 'doctor' | 'nurse';
  staffId: string;
  departmentId: string;
  date: string;
  shift: Shift;
  timeIn: string;
  timeOut: string;
  status: DutyStatus;
  assignedBy: string;
};

@Injectable()
export class DutiesService {
  constructor(
    @InjectModel(DutyRecord.name) private readonly dutyModel: Model<DutyRecordDocument>,
    private readonly usersService: UsersService,
    private readonly departmentsService: DepartmentsService
  ) {}

  async create(dto: CreateDutyDto): Promise<DutyRecordDocument> {
    if (!['doctor', 'nurse'].includes(dto.role)) throw new BadRequestException('Invalid role');
    const user = await this.usersService.findById(dto.staffId);
    if (!user) throw new BadRequestException('Staff not found');
    const deptList = await this.departmentsService.list();
    const okDept = deptList.find((d: any) => String(d._id) === String(dto.departmentId));
    if (!okDept) throw new BadRequestException('Department not found');
    const date = new Date(dto.date);
    const timeIn = new Date(dto.timeIn);
    const timeOut = new Date(dto.timeOut);
    if (!(timeOut > timeIn)) throw new BadRequestException('timeOut must be later than timeIn');
    const doc = new this.dutyModel({
      doctorUserId: dto.role === 'doctor' ? dto.staffId : undefined,
      nurseUserId: dto.role === 'nurse' ? dto.staffId : undefined,
      departmentId: dto.departmentId,
      date,
      shift: dto.shift,
      timeIn,
      timeOut,
      status: dto.status,
      assignedBy: dto.assignedBy
    });
    const saved = await doc.save();
    if (dto.role === 'nurse') {
      await this.usersService.update(dto.staffId, { department: (okDept as any).name } as any);
    }
    return saved;
  }

  async list(filters: { role?: 'doctor' | 'nurse'; departmentId?: string; date?: string; shift?: Shift }) {
    const q: any = {};
    if (filters.role === 'doctor') q.doctorUserId = { $ne: null };
    if (filters.role === 'nurse') q.nurseUserId = { $ne: null };
    if (filters.departmentId) q.departmentId = filters.departmentId;
    if (filters.date) {
      const d = new Date(filters.date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      q.date = { $gte: d, $lt: next };
    }
    if (filters.shift) q.shift = filters.shift;
    const list = await this.dutyModel.find(q).lean();
    return list;
  }

  async isNurseOnDutyNow(nurseUserId: string): Promise<boolean> {
    const now = new Date();
    const h = now.getHours();
    const min = now.getMinutes();
    const isMorning = (h > 8 && h < 14) || (h === 8 && min >= 0) || (h === 13 && min <= 59);
    const isAfternoon = (h > 14 && h < 21) || (h === 14 && min >= 0) || (h === 20 && min <= 59);
    const isNight = h >= 21 || h < 8;
    let shift: Shift | null = null;
    if (isMorning) shift = Shift.MORNING;
    else if (isAfternoon) shift = Shift.AFTERNOON;
    else if (isNight) shift = Shift.NIGHT;
    if (!shift) return false;
    const base = new Date(now);
    if (shift === Shift.NIGHT && h < 8) {
      base.setDate(base.getDate() - 1);
    }
    const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const duty = await this.dutyModel.findOne({
      nurseUserId,
      date: { $gte: dayStart, $lt: dayEnd },
      shift,
      status: DutyStatus.ON_DUTY
    }).lean();
    return !!duty;
  }

  async isDoctorOnDutyNow(doctorUserId: string): Promise<boolean> {
    const now = new Date();
    const h = now.getHours();
    const min = now.getMinutes();
    const isMorning = (h > 8 && h < 14) || (h === 8 && min >= 0) || (h === 13 && min <= 59);
    const isAfternoon = (h > 14 && h < 21) || (h === 14 && min >= 0) || (h === 20 && min <= 59);
    const isNight = h >= 21 || h < 8;
    let shift: Shift | null = null;
    if (isMorning) shift = Shift.MORNING;
    else if (isAfternoon) shift = Shift.AFTERNOON;
    else if (isNight) shift = Shift.NIGHT;
    if (!shift) return false;
    const base = new Date(now);
    if (shift === Shift.NIGHT && h < 8) {
      base.setDate(base.getDate() - 1);
    }
    const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const duty = await this.dutyModel.findOne({
      doctorUserId,
      date: { $gte: dayStart, $lt: dayEnd },
      shift,
      status: DutyStatus.ON_DUTY
    }).lean();
    return !!duty;
  }
}
