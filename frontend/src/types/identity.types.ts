export interface IUser {
    id: string;
    email: string;
    fullName: string;
    role: string;
    avatar?: string;
}

export interface ILogin {
    accessToken: string;
    user: IUser;
}

export interface IRegister {
    fullName: string;
    email: string;
    password: string;
    phone: string;
}
