import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DutyRecord, DutyRecordDocument, Shift, DutyStatus } from './duty.schema';
import { UsersService } from '../users/users.service';
import { DepartmentsService } from '../departments/departments.service';

type CreateDutyDto = {
  role: 'doctor' | 'staff' | 'recording' | 'radiology';
  staffId?: string;
  staffIds?: string[];
  departmentId: string;
  date: string;
  shift: Shift;
  timeIn: string;
  timeOut: string;
  status: DutyStatus;
  assignedBy: string;
};

@Injectable()
export class DutiesService implements OnModuleInit {
  constructor(
    @InjectModel(DutyRecord.name) private readonly dutyModel: Model<DutyRecordDocument>,
    private readonly usersService: UsersService,
    private readonly departmentsService: DepartmentsService
  ) {}

  async onModuleInit() {
    await this.dutyModel.syncIndexes();
  }

  async create(dto: CreateDutyDto): Promise<DutyRecordDocument | { createdCount: number; duties: DutyRecordDocument[] }> {
    const rawRole = String(dto.role || '').trim().toLowerCase();
    const normalizedRole = (rawRole === 'nurse' ? 'staff' : rawRole) as CreateDutyDto['role'];
    if (!['doctor', 'staff', 'recording', 'radiology'].includes(normalizedRole)) throw new BadRequestException('Invalid role');
    dto.role = normalizedRole;
    const staffIds = Array.from(
      new Set([dto.staffId, ...(dto.staffIds || [])].filter((id): id is string => !!id && id.trim().length > 0))
    );
    if (staffIds.length === 0) throw new BadRequestException('At least one staff is required');
    if (staffIds.length > 1000) throw new BadRequestException('A duty assignment can include at most 1000 staff');
    const deptList = await this.departmentsService.list();
    const okDept = deptList.find((d: any) => String(d._id) === String(dto.departmentId));
    if (!okDept) throw new BadRequestException('Department not found');
    const date = new Date(dto.date);
    const timeIn = new Date(dto.timeIn);
    const timeOut = new Date(dto.timeOut);
    if (!(timeOut > timeIn)) throw new BadRequestException('timeOut must be later than timeIn');
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const maxStart = new Date(todayStart);
    maxStart.setDate(maxStart.getDate() + 3);
    const dutyDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (dutyDay < todayStart || dutyDay > maxStart) {
      throw new BadRequestException('Duty date must be within the next 3 days');
    }
    const users = await Promise.all(staffIds.map((staffId) => this.usersService.findById(staffId)));
    const missingIds = staffIds.filter((_staffId, index) => !users[index]);
    if (missingIds.length > 0) {
      throw new BadRequestException(`Staff not found: ${missingIds.slice(0, 10).join(', ')}`);
    }
    if (staffIds.length === 1) {
      const doc = new this.dutyModel({
        doctorUserId: dto.role === 'doctor' ? staffIds[0] : undefined,
        nurseUserId: dto.role === 'staff' ? staffIds[0] : undefined,
        recordingUserId: dto.role === 'recording' ? staffIds[0] : undefined,
        radiologyUserId: dto.role === 'radiology' ? staffIds[0] : undefined,
        departmentId: dto.departmentId,
        date,
        shift: dto.shift,
        timeIn,
        timeOut,
        status: dto.status,
        assignedBy: dto.assignedBy
      });
      const saved = await doc.save();
      if (dto.role === 'staff') {
        await this.usersService.update(staffIds[0], { department: (okDept as any).name } as any);
      }
      return saved;
    }
    const docs = staffIds.map((staffId) => ({
      doctorUserId: dto.role === 'doctor' ? staffId : undefined,
      nurseUserId: dto.role === 'staff' ? staffId : undefined,
      recordingUserId: dto.role === 'recording' ? staffId : undefined,
      radiologyUserId: dto.role === 'radiology' ? staffId : undefined,
      departmentId: dto.departmentId,
      date,
      shift: dto.shift,
      timeIn,
      timeOut,
      status: dto.status,
      assignedBy: dto.assignedBy
    }));
    const saved = await this.dutyModel.insertMany(docs);
    if (dto.role === 'staff') {
      await Promise.all(
        staffIds.map((staffId) => this.usersService.update(staffId, { department: (okDept as any).name } as any))
      );
    }
    return { createdCount: saved.length, duties: saved };
  }

  async list(filters: { role?: 'doctor' | 'staff' | 'recording' | 'radiology'; departmentId?: string; date?: string; shift?: Shift }) {
    const q: any = {};
    if (filters.role === 'doctor') q.doctorUserId = { $ne: null };
    if (filters.role === 'staff') q.nurseUserId = { $ne: null };
    if (filters.role === 'recording') q.recordingUserId = { $ne: null };
    if (filters.role === 'radiology') q.radiologyUserId = { $ne: null };
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
  async update(id: string, dto: Partial<{ departmentId: string; date: string; shift: Shift; timeIn: string; timeOut: string; status: DutyStatus }>) {
    const update: any = {};
    if (dto.departmentId) update.departmentId = dto.departmentId;
    if (dto.shift) update.shift = dto.shift;
    if (dto.status) update.status = dto.status;
    if (dto.date) update.date = new Date(dto.date);
    if (dto.timeIn) update.timeIn = new Date(dto.timeIn);
    if (dto.timeOut) update.timeOut = new Date(dto.timeOut);
    if (update.timeIn && update.timeOut && !(update.timeOut > update.timeIn)) {
      throw new BadRequestException('timeOut must be later than timeIn');
    }
    const doc = await this.dutyModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new BadRequestException('Duty not found');
    if (dto.departmentId && doc.nurseUserId) {
      const deptList = await this.departmentsService.list();
      const okDept = deptList.find((d: any) => String(d._id) === String(dto.departmentId));
      if (okDept) await this.usersService.update(doc.nurseUserId as any, { department: (okDept as any).name } as any);
    }
    return doc.toObject();
  }
  async remove(id: string) {
    const res = await this.dutyModel.findByIdAndDelete(id);
    if (!res) throw new BadRequestException('Duty not found');
    return { ok: true };
  }

  async isNurseOnDutyNow(nurseUserId: string): Promise<boolean> {
    return this.isStaffOnDutyNow(nurseUserId);
  }

  async isStaffOnDutyNow(staffUserId: string): Promise<boolean> {
    const now = new Date();
    const h = now.getHours();
    const isMorning = h >= 8 && h < 14;
    const isAfternoon = h >= 14 && h < 21;
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
      nurseUserId: staffUserId,
      date: { $gte: dayStart, $lt: dayEnd },
      shift,
      status: DutyStatus.ON_DUTY
    }).lean();
    return !!duty;
  }

  async isDoctorOnDutyNow(doctorUserId: string): Promise<boolean> {
    const now = new Date();
    const h = now.getHours();
    const isMorning = h >= 8 && h < 14;
    const isAfternoon = h >= 14 && h < 21;
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

  async isRecordingOnDutyNow(recordingUserId: string): Promise<boolean> {
    const now = new Date();
    const h = now.getHours();
    const isMorning = h >= 8 && h < 14;
    const isAfternoon = h >= 14 && h < 21;
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
      recordingUserId,
      date: { $gte: dayStart, $lt: dayEnd },
      shift,
      status: DutyStatus.ON_DUTY
    }).lean();
    return !!duty;
  }

  async getById(id: string) {
    return this.dutyModel.findById(id).lean();
  }
}
