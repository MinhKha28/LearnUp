/**
 * LearnUP Course Service development fixture (create-only).
 * Canonical principals: identity-service DevAccountSeeder and tenant-service ABC.
 * This file does not modify any existing record and does not clear databases.
 * Synthetic MediaFile entries represent metadata only (no Cloudinary upload).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client';
import { COURSE_STATUS, COURSE_TYPE } from '../src/modules/courses/course-values';

const ORG_ID = '01900000-0000-7000-8000-00000000a001';
const ORGANIZER_ID = '01900000-0000-7000-8000-00000000a010';
const INSTRUCTOR_ID = '01900000-0000-7000-8000-00000000a101';
const LEARNER_ID = '01900000-0000-7000-8000-00000000a201';
const ADMIN_ID = '01900000-0000-7000-8000-000000000001';

// Namespace-based, reproducible UUIDs; distinct from the original 0199a... fixtures.
const fixtureId = (kind: number, n: number) =>
  `01900000-0000-7000-8000-${kind.toString(16).padStart(4, '0')}${n.toString(16).padStart(8, '0')}`;
const time = (date: string) => new Date(`${date}T08:00:00.000Z`);
const STATUS = COURSE_STATUS;
const TYPE = COURSE_TYPE;

type Status = (typeof STATUS)[keyof typeof STATUS];
type Kind = 'Video' | 'Reading';
type CaseDefinition = {
  code: string;
  chain: number;
  version: number;
  name: string;
  status: Status;
  type: (typeof TYPE)[keyof typeof TYPE];
  created: string;
  submitted?: string;
  published?: string;
  archived?: string;
  rejected?: string;
  rejectedReason?: string;
  disabled?: string;
  disabledReason?: string;
  locked?: string;
  days: number;
  assignments: number;
  lessons: number;
  media: 'none' | 'video' | 'reading' | 'mixed' | 'optional' | 'disabled';
};

// Purposefully diverse positive/negative/edge-case fixtures.
const CASES: CaseDefinition[] = [
  { code:'DRAFT_EMPTY',chain:1,version:1,name:'[SEED] Bản nháp chưa có nội dung',status:STATUS.DRAFT,type:TYPE.PUBLIC,created:'2026-08-01',days:7,assignments:0,lessons:0,media:'none' },
  { code:'DRAFT_VIDEO',chain:2,version:1,name:'[SEED] An toàn lao động - video bắt buộc',status:STATUS.DRAFT,type:TYPE.PUBLIC,created:'2026-08-03',days:14,assignments:0,lessons:2,media:'video' },
  { code:'DRAFT_READING',chain:3,version:1,name:'[SEED] Quy trình nội bộ - tài liệu đọc',status:STATUS.DRAFT,type:TYPE.PRIVATE,created:'2026-08-05',days:10,assignments:0,lessons:2,media:'reading' },
  { code:'DRAFT_OPTIONAL',chain:4,version:1,name:'[SEED] Học liệu tự chọn không tính thời lượng',status:STATUS.DRAFT,type:TYPE.PRIVATE,created:'2026-08-07',days:5,assignments:0,lessons:1,media:'optional' },
  { code:'SUBMITTED_PUBLIC',chain:5,version:1,name:'[SEED] Nhận diện rủi ro - chờ duyệt',status:STATUS.SUBMITTED,type:TYPE.PUBLIC,created:'2026-08-10',submitted:'2026-08-15',days:12,assignments:30,lessons:3,media:'mixed' },
  { code:'SUBMITTED_PRIVATE',chain:6,version:1,name:'[SEED] Bảo mật tài liệu - chờ duyệt',status:STATUS.SUBMITTED,type:TYPE.PRIVATE,created:'2026-08-12',submitted:'2026-08-17',days:14,assignments:0,lessons:2,media:'mixed' },
  { code:'REJECTED_PUBLIC',chain:7,version:1,name:'[SEED] Giao tiếp khách hàng - bị từ chối',status:STATUS.REJECTED,type:TYPE.PUBLIC,created:'2026-08-13',submitted:'2026-08-17',rejected:'2026-08-19',rejectedReason:'Cần bổ sung mục tiêu đào tạo và minh chứng đánh giá.',days:10,assignments:15,lessons:2,media:'mixed' },
  { code:'REJECTED_PRIVATE',chain:8,version:1,name:'[SEED] Quy trình phê duyệt - bị từ chối',status:STATUS.REJECTED,type:TYPE.PRIVATE,created:'2026-08-16',submitted:'2026-08-20',rejected:'2026-08-23',rejectedReason:'Tài liệu chưa phù hợp với quy trình nội bộ hiện hành.',days:7,assignments:0,lessons:1,media:'reading' },
  { code:'VERSION1_ARCHIVED',chain:9,version:1,name:'[SEED] An toàn phòng cháy - phiên bản 1',status:STATUS.ARCHIVED,type:TYPE.PUBLIC,created:'2026-07-01',submitted:'2026-07-09',published:'2026-07-12',archived:'2026-09-11',locked:'2026-08-01',days:14,assignments:20,lessons:3,media:'mixed' },
  { code:'VERSION2_PUBLISHED',chain:9,version:2,name:'[SEED] An toàn phòng cháy - phiên bản 2',status:STATUS.PUBLISHED,type:TYPE.PUBLIC,created:'2026-09-01',submitted:'2026-09-07',published:'2026-09-11',days:14,assignments:30,lessons:3,media:'mixed' },
  { code:'PUBLISHED_PRIVATE',chain:10,version:1,name:'[SEED] Bảo vệ dữ liệu cá nhân',status:STATUS.PUBLISHED,type:TYPE.PRIVATE,created:'2026-08-20',submitted:'2026-08-25',published:'2026-08-28',days:7,assignments:45,lessons:3,media:'mixed' },
  { code:'PUBLISHED_LOCKED',chain:11,version:1,name:'[SEED] Hội nhập nhân viên - đã khóa',status:STATUS.PUBLISHED,type:TYPE.PUBLIC,created:'2026-08-21',submitted:'2026-08-26',published:'2026-08-29',locked:'2026-09-03',days:10,assignments:0,lessons:3,media:'mixed' },
  { code:'PUBLISHED_DISABLED_MATERIAL',chain:12,version:1,name:'[SEED] Sơ cứu - học liệu bị vô hiệu hóa',status:STATUS.PUBLISHED,type:TYPE.PUBLIC,created:'2026-08-23',submitted:'2026-08-27',published:'2026-08-30',days:8,assignments:10,lessons:2,media:'disabled' },
  { code:'DISABLED_COURSE',chain:13,version:1,name:'[SEED] Ứng xử trên mạng - bị vô hiệu hóa',status:STATUS.DISABLED,type:TYPE.PUBLIC,created:'2026-07-05',submitted:'2026-07-10',published:'2026-07-13',locked:'2026-08-03',disabled:'2026-09-20',disabledReason:'Nội dung được báo cáo vi phạm quy định.',days:7,assignments:15,lessons:2,media:'mixed' },
  { code:'DRAFT_ASSIGNMENT_ONLY',chain:14,version:1,name:'[SEED] Thực hành công việc - chỉ Assignment',status:STATUS.DRAFT,type:TYPE.PRIVATE,created:'2026-09-21',days:7,assignments:75,lessons:1,media:'none' },
  { code:'PUBLISHED_NO_ASSIGNMENT',chain:15,version:1,name:'[SEED] Kiến thức nền - không Assignment',status:STATUS.PUBLISHED,type:TYPE.PUBLIC,created:'2026-09-01',submitted:'2026-09-04',published:'2026-09-06',days:5,assignments:0,lessons:2,media:'mixed' },
];

function validateFixture(f: CaseDefinition) {
  const c=time(f.created).getTime();
  const submitted=f.submitted ? time(f.submitted).getTime() : null;
  const published=f.published ? time(f.published).getTime() : null;
  const rejected=f.rejected ? time(f.rejected).getTime() : null;
  const archived=f.archived ? time(f.archived).getTime() : null;
  const disabled=f.disabled ? time(f.disabled).getTime() : null;
  const locked=f.locked ? time(f.locked).getTime() : null;
  const check=(value:number|null,earliest:number|null,label:string) => {
    if (value!==null && (earliest===null || value<earliest)) throw new Error(`Invalid ${label} timeline for ${f.code}`);
  };
  check(submitted,c,'submitted'); check(published,submitted,'published');
  check(rejected,submitted,'rejected');check(archived,published,'archived');
  check(disabled,published,'disabled');check(locked,published,'locked');
  if(f.status===STATUS.DRAFT && (submitted||published)) throw new Error(`Draft cannot have approval dates: ${f.code}`);
  if(f.status===STATUS.PUBLISHED && !published) throw new Error(`Published missing date: ${f.code}`);
  if(f.status===STATUS.SUBMITTED && !submitted) throw new Error(`Submitted missing date: ${f.code}`);
  if(f.status===STATUS.REJECTED && (!rejected||!f.rejectedReason)) throw new Error(`Rejected incomplete: ${f.code}`);
  if(f.status===STATUS.ARCHIVED && !archived) throw new Error(`Archived missing date: ${f.code}`);
  if(f.status===STATUS.DISABLED && (!disabled||!f.disabledReason)) throw new Error(`Disabled incomplete: ${f.code}`);
}

async function createIfMissing<T>(lookup:()=>Promise<T|null>,create:()=>Promise<unknown>):Promise<boolean>{
  if(await lookup())return false;
  await create();
  return true;
}

async function seed(prisma:PrismaClient){
  CASES.forEach(validateFixture);
  const now=new Date();
  if(now<time('2026-10-01')) throw new Error('Fixture dates are in the future.');
  const stats:Record<string,number>={};
  const count=(label:string,created:boolean)=>{if(created)stats[label]=(stats[label]??0)+1;};
  const settingId=fixtureId(0xf001,1);
  count('platform_settings',await createIfMissing(
    ()=>prisma.platformSetting.findUnique({where:{id:settingId}}),
    ()=>prisma.platformSetting.create({data:{id:settingId,sourceAsOf:time('2026-10-01'),readingSpeedWordsPerMinute:200,studyMinutesPerDay:60}})
  ));
  for(const f of CASES){
    const chainId=fixtureId(0xc001,f.chain);
    const courseId=fixtureId(0xc002,f.chain*10+f.version);
    const createdAt=time(f.created);
    count('course_chains',await createIfMissing(
      ()=>prisma.courseChain.findUnique({where:{id:chainId}}),
      ()=>prisma.courseChain.create({data:{id:chainId,organizationId:ORG_ID,instructorId:INSTRUCTOR_ID,createdAt,updatedAt:createdAt}})
    ));
    const eventTime=f.disabled??f.archived??f.rejected??f.published??f.submitted??f.created;
    count('courses',await createIfMissing(
      ()=>prisma.course.findUnique({where:{id:courseId}}),
      ()=>prisma.course.create({data:{id:courseId,organizationId:ORG_ID,chainId,versionNumber:f.version,
        name:f.name,shortDescription:`Dữ liệu phát triển LearnUP – tình huống ${f.code}.`,
        trainingObjectives:'Nhận diện tình huống, vận dụng kiến thức và thực hiện đúng quy trình trong công việc.',
        learningOutcomes:['Trình bày kiến thức cốt lõi','Giải quyết tình huống thực tiễn'],
        courseType:f.type,status:f.status,expectedCompletionDays:f.days,
        submittedAt:f.submitted?time(f.submitted):null,publishedAt:f.published?time(f.published):null,
        archivedAt:f.archived?time(f.archived):null,rejectedAt:f.rejected?time(f.rejected):null,
        rejectionReason:f.rejectedReason??null,disabledAt:f.disabled?time(f.disabled):null,
        disabledReason:f.disabledReason??null,lockedAt:f.locked?time(f.locked):null,
        assignmentMinutes:f.assignments,assignmentMinutesAsOf:f.assignments?time(f.created):null,
        createdAt,updatedAt:time(eventTime)}})
    ));
    if(!f.lessons)continue;
    const moduleCount=f.lessons>2?2:1;
    for(let mi=0;mi<moduleCount;mi++){
      const moduleSeq=f.chain*100+f.version*10+mi+1;
      const moduleId=fixtureId(0xc003,moduleSeq);
      count('modules',await createIfMissing(
        ()=>prisma.courseModule.findUnique({where:{id:moduleId}}),
        ()=>prisma.courseModule.create({data:{id:moduleId,organizationId:ORG_ID,courseId,
          title:mi===0?'Kiến thức nền tảng':'Thực hành và tình huống',position:mi+1,createdAt,updatedAt:createdAt}})
      ));
      const lessonStart=mi===0?0:2;
      const lessonEnd=mi===0?Math.min(2,f.lessons):f.lessons;
      for(let li=lessonStart;li<lessonEnd;li++){
        const lessonSeq=f.chain*1000+f.version*100+li+1;
        const lessonId=fixtureId(0xc004,lessonSeq);
        const isDisabledLesson=f.media==='disabled'&&li===f.lessons-1;
        count('lessons',await createIfMissing(
          ()=>prisma.lesson.findUnique({where:{id:lessonId}}),
          ()=>prisma.lesson.create({data:{id:lessonId,organizationId:ORG_ID,moduleId,
            title:`Bài ${li+1}: ${f.name.replace('[SEED] ','')}`,
            content:`## Kiến thức cần nắm\n\nTình huống minh họa ${f.code}, bài ${li+1}.\n\n- Nhận diện vấn đề\n- Áp dụng đúng quy trình\n- Kiểm tra kết quả`,
            position:li-lessonStart+1,disabledAt:isDisabledLesson?time('2026-09-12'):null,
            createdAt,updatedAt:createdAt}})
        ));
        const variants:{kind:Kind;required:boolean;disabled:boolean;amount:number}[]=[];
        if(f.media==='video')variants.push({kind:'Video',required:true,disabled:false,amount:li===0?121:600});
        if(f.media==='reading')variants.push({kind:'Reading',required:true,disabled:false,amount:li===0?1001:800});
        if(f.media==='mixed')variants.push(
          {kind:'Video',required:true,disabled:false,amount:li===0?601:485},
          {kind:'Reading',required:true,disabled:false,amount:li===0?1001:625},
          {kind:'Video',required:false,disabled:false,amount:900});
        if(f.media==='optional')variants.push({kind:'Video',required:false,disabled:false,amount:600},{kind:'Reading',required:false,disabled:false,amount:1200});
        if(f.media==='disabled')variants.push({kind:'Video',required:true,disabled:li===0,amount:305},{kind:'Reading',required:true,disabled:false,amount:750});
        for(let j=0;j<variants.length;j++){
          const v=variants[j]; const n=lessonSeq*10+j+1;
          const materialId=fixtureId(0xc005,n);const fileId=fixtureId(0xc006,n);
          const mediaAt=createdAt;
          count('media_files',await createIfMissing(
            ()=>prisma.mediaFile.findUnique({where:{id:fileId}}),
            ()=>prisma.mediaFile.create({data:{id:fileId,organizationId:ORG_ID,
              purpose:v.kind==='Video'?'MaterialVideo':'MaterialReading',status:'Ready',
              storageKey:`seed/learnup-abc/${f.code.toLowerCase()}/${fileId}`,
              originalFilename:`${f.code.toLowerCase()}-${n}.${v.kind==='Video'?'mp4':'pdf'}`,
              mimeType:v.kind==='Video'?'video/mp4':'application/pdf',
              sizeBytes:BigInt(v.kind==='Video'?v.amount*250000:v.amount*60),
              durationSeconds:v.kind==='Video'?v.amount:null,wordCount:v.kind==='Reading'?v.amount:null,
              readyAt:mediaAt,createdAt:mediaAt,updatedAt:mediaAt}})
          ));
          count('materials',await createIfMissing(
            ()=>prisma.material.findUnique({where:{id:materialId}}),
            ()=>prisma.material.create({data:{id:materialId,organizationId:ORG_ID,lessonId,
              materialType:v.kind,title:`${v.kind==='Video'?'Video hướng dẫn':'Tài liệu đọc'} ${li+1}.${j+1}`,
              isRequired:v.required,fileId,position:j+1,
              disabledAt:v.disabled?time('2026-09-12'):null,
              createdAt,updatedAt:createdAt}})
          ));
        }
      }
    }
  }
  // Intentional: ContentReport is a transactional moderation aggregate and OutboxEvent is an
  // event delivery queue. Neither is fabricated here until accepted statuses and workflow
  // side-effects are verified against the actual Course report service.
  // OrganizationQuotaLock is a concurrency lock table, not business fixture data.
  console.table(stats);
  console.log(`Fixture principals: organizer=${ORGANIZER_ID}, instructor=${INSTRUCTOR_ID}, learner=${LEARNER_ID}, admin=${ADMIN_ID}; org=${ORG_ID}`);
  console.log(`Course test cases: ${CASES.length}. No pre-existing rows were updated or deleted.`);
}

async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Refusing seed in production');
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
  const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
  try{await seed(prisma);}finally{await prisma.$disconnect();}
}
main().catch((err:unknown)=>{console.error(err);process.exitCode=1;});
