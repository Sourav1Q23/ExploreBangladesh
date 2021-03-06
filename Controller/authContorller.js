const { promisify } = require('util');
const User = require('./../Model/userModel')
const asyncHandler = require('../utility/asyncHandler')
const jwt = require('jsonwebtoken');
const AppError = require('../utility/appError');
const sendEmail = require('./../utility/emailutil');
const crypto = require('crypto');

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });
  };
const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    const cookieOptions = {
        expires: new Date(
          Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true
      };
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
    
    res.cookie('jwt', token, cookieOptions);
    
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: { user }
    });
};


exports.signup= asyncHandler(async(req,res,next)=>{
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm 
    })

    createSendToken(newUser,201,res)
});

exports.login = asyncHandler(async (req,res,next)=>{
    const {email, password} = req.body;
    
    if(!email || !password){
        next(new AppError("Please provide email and password",400))
    }
    // Check if user exist with the given email
    const user = await User.findOne({email})
    if (!user){
        return next(new AppError('Invalid Email or Password',401))
    }
    const isValid = user.validPassword(password, user.password)
    if (!isValid){
        return next(new AppError('Invalid Email or Password',401))
    }
    
    createSendToken(user,200,res)

}); 

exports.authentication = asyncHandler(async (req, res, next) => {
    // 1) Getting token and check of it's there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
  
    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }
  
    // 2) Verification token
    const payload = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  
    // 3) Check if user still exists
    const currentUser = await User.findById(payload.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token does no longer exist.',401));
    }
  
    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password! Please log in again.', 401)
      );
    }
  
    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  });

  exports.authorize= (...roles) => {
    return (req, res, next) => {
      // roles ['admin', 'lead-guide']. role='user'
      if (!roles.includes(req.user.role)) {
        return next(
          new AppError('You do not have permission to perform this action', 403)
        );
      }
  
      next();
    };
  };
  exports.forgotPassword = asyncHandler(async (req, res, next) => {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return next(new AppError('There is no user with email address.', 404));
    }
  
    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
  
    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
  
    const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;
  
    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10 min)',
        message
      });
  
      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!'
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
  
      return next(
        new AppError('There was an error sending the email. Try again later!'),
        500
      );
    }
  });
  
  exports.resetPassword = asyncHandler(async (req, res, next) => {
    // 1) Get user based on the token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
  
    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  
    // 4) Log the user in, send JWT
    createSendToken(newUser,200,res)
  });
exports.updatePassword  = asyncHandler(async (req,res,next)=>{
    const user = await User.findById(req.user.id);

    const isValid = user.validPassword(req.body.password,user.password)

    if (!isValid){
          next(new AppError('Invalid Password',401))
        }
    user.password= req.body.newPassword
    user.passwordConfirm= req.body.newPasswordConfirm

    await user.save()

    createSendToken(newUser,200,res)
  });
  
  
  