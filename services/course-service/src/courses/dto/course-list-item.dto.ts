export class CourseListItemDto {
  id!: string;
  chainId!: string;
  versionNumber!: number;
  name!: string;
  courseType!: string;
  status!: string;
  locked!: boolean;
  learnerCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
