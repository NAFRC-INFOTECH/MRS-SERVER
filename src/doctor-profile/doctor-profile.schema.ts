import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DoctorProfileDocument = DoctorProfile & Document;

@Schema({ _id: false })
class PersonalInfo {
  @Prop({ required: true })
  id: string;
  @Prop({ default: '' })
  fullName: string;
  @Prop({ default: '' })
  dateOfBirth: string;
  @Prop({ default: '' })
  gender: string;
  @Prop({ default: '' })
  nationality: string;
  @Prop({ default: '' })
  phone: string;
  @Prop({ default: '' })
  email: string;
  @Prop({ default: '' })
  address: string;
  @Prop({ default: '' })
  idDocument: string;
  @Prop({ default: '' })
  emergencyContact: string;
  @Prop({ default: '' })
  imageUrl: string;
  @Prop({ default: '' })
  hospital: string;
  @Prop({ default: 'pending' })
  status: string;
}

@Schema({ _id: false })
class Qualifications {
  @Prop({ default: '' }) medicalDegree: string;
  @Prop({ default: '' }) specialization: string;
  @Prop({ default: '' }) licenses: string;
  @Prop({ default: '' }) boardCertifications: string;
  @Prop({ default: '' }) additionalCertifications: string;
  @Prop({ default: '' }) medicalSchool: string;
  @Prop({ default: '' }) graduationYear: string;
}

@Schema({ _id: false })
class Experience {
  @Prop({ default: '' }) employers: string;
  @Prop({ default: '' }) jobTitles: string;
  @Prop({ default: '' }) responsibilities: string;
  @Prop({ default: '' }) references: string;
  @Prop({ default: '' }) specializedExperience: string;
}

@Schema({ _id: false })
class Cme {
  @Prop({ default: '' }) workshops: string;
  @Prop({ default: '' }) research: string;
  @Prop({ default: '' }) fellowships: string;
}

@Schema({ _id: false })
class Skills {
  @Prop({ default: '' }) clinicalSkills: string;
  @Prop({ default: '' }) surgicalExperience: string;
  @Prop({ default: '' }) equipment: string;
  @Prop({ default: '' }) leadership: string;
}

@Schema({ _id: false })
class Health {
  @Prop({ default: '' }) medicalHistory: string;
  @Prop({ default: '' }) vaccinations: string;
  @Prop({ default: '' }) screenings: string;
}

@Schema({ _id: false })
class Legal {
  @Prop({ default: '' }) licenseProof: string;
  @Prop({ default: '' }) backgroundCheck: string;
  @Prop({ default: '' }) insurance: string;
}

@Schema({ _id: false })
class Statement {
  @Prop({ default: '' }) motivation: string;
  @Prop({ default: '' }) careerGoals: string;
  @Prop({ default: '' }) hospitalReason: string;
}

@Schema({ _id: false })
class Documents {
  @Prop({ default: '' }) cv: string;
  @Prop({ default: '' }) photo: string;
  @Prop({ default: '' }) contract: string;
  @Prop({ default: '' }) availability: string;
}

@Schema({ timestamps: true, collection: 'doctor_profiles' })
export class DoctorProfile {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: PersonalInfo, required: true })
  personalInfo: PersonalInfo;

  @Prop({ type: Qualifications, default: {} })
  qualifications: Qualifications;

  @Prop({ type: Experience, default: {} })
  experience: Experience;

  @Prop({ type: Cme, default: {} })
  cme: Cme;

  @Prop({ type: Skills, default: {} })
  skills: Skills;

  @Prop({ type: Health, default: {} })
  health: Health;

  @Prop({ type: Legal, default: {} })
  legal: Legal;

  @Prop({ type: Statement, default: {} })
  statement: Statement;

  @Prop({ type: Documents, default: {} })
  documents: Documents;

  @Prop({ default: 0 })
  stepsCompleted: number;
}

export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
