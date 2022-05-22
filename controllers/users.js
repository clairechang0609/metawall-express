const { successHandler, errorHandler } = require('../service/handler');
const appError = require('../service/appError');
const handleErrorAsync = require('../service/handleErrorAsync');
const bcrypt = require('bcryptjs'); // 密碼加密
const validator = require('validator'); // 格式驗證
const User = require('../models/usersModel');
const Post = require('../models/postsModel');
const Follow = require('../models/followsModel');
const { checkAuth, generateSendJWT } = require('../service/auth');
const checkObjectId = require('../service/validation');
const dotenv = require('dotenv');
dotenv.config({path: './config.env'});

const users = {
    register: handleErrorAsync(async (req, res, next) => {
        let { name, email, password, confirmPassword } = req.body;
        if ( !name || !email || !password || !confirmPassword) {
            return appError('欄位未填寫完整', 400, next);
        }
        const errorMessageArr = [];
        if (password !== confirmPassword) {
            errorMessageArr.push('密碼不一致');
        }
        if (!validator.isLength(password, { min: 8 })) {
            errorMessageArr.push('密碼長度必須超過 8 碼');
        }
        if (!validator.isEmail(email)) {
            errorMessageArr.push('email 格式不正確');
        }
        if (errorMessageArr.length > 0) {
            const errorMessage = errorMessageArr.join(', ');
            return appError(errorMessage, 400, next);
        }

        const findUserByMail = await User.findOne({ email });
        if (findUserByMail) {
            return appError('email 已註冊', 400, next);
        }

        password = await bcrypt.hash(password, 12); // 密碼加密
        const data = { name, email, password, photo: '', gender: '' };
        await User.create(data);
        successHandler(res, "註冊成功，請重新登入", {}, 201);
    }),
    login: handleErrorAsync(async (req, res, next) => {
        let { email, password } = req.body;
        if (!email || !password) {
            return appError('帳號及密碼必填', 400, next);
        }
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return appError('帳號錯誤或尚未註冊', 400, next);
        }
        const isVerify = await bcrypt.compare(password, user.password);
        if (!isVerify) {
            return appError('您的密碼不正確', 400, next);
        }
        generateSendJWT(res, "登入成功", user); // 產生 token
    }),
    getOwnProfile: handleErrorAsync(async (req, res, next) => {
        successHandler(res, "取得成功", req.user);
    }),
    getProfileById: handleErrorAsync(async (req, res, next) => {
        const id = req.params.id;
        checkObjectId(id, next);
        const findUser = await User.findById(id);
        if (!findUser) {
            return appError('查無使用者', 400, next);
        }
        const { name, photo } = findUser;
        const followers = await (await Follow.find({ following: id })).length; // 追蹤者數
        const findFollow = await Follow.findOne({ user: req.user.id, following: id });
        const isFollow = Boolean(findFollow); // 是否追蹤
        successHandler(res, "取得成功", { name, photo, followers, isFollow });
    }),
    updatePassword: handleErrorAsync(async (req, res, next) => {
        const { password, confirmPassword } = req.body;
        const errorMessageArr = [];
        if (password !== confirmPassword) {
            errorMessageArr.push('密碼不一致');
        }
        if (!validator.isLength(password, { min: 8 })) {
            errorMessageArr.push('密碼長度必須超過 8 碼');
        }
        if (errorMessageArr.length > 0) {
            const errorMessage = errorMessageArr.join(', ');
            return appError(errorMessage, 400, next);
        }
        newPassword = await bcrypt.hash(password, 12); // 密碼加密
        const updateUser = await User.findByIdAndUpdate(req.user.id, {
            password: newPassword
        });
        generateSendJWT(res, "更新成功", updateUser); // 產生新 token
    }),
    patchProfile: handleErrorAsync(async (req, res, next) => {
        const { name, photo, gender } = req.body;
        const data = { name, photo, gender };
        if (!name) {
            return appError("名稱必填", 400, next);
        }
        await User.findByIdAndUpdate(req.user.id, data);
        const updateUser = await User.findById(req.user.id);
        successHandler(res, "更新成功", updateUser);
    }),
    getLikePosts: handleErrorAsync (async (req, res, next) => {
        const userId = req.user.id; // 登入者
        let posts = await Post.find({ likes: { $in: [ userId ] } })
            .populate({
                path: 'user',
                select: 'name photo'
            })
            .sort('-createdAt');
        successHandler(res, "取得成功", posts);
    })
}

module.exports = users;