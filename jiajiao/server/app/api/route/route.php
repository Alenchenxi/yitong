<?php
// +----------------------------------------------------------------------
// | ThinkPHP [ WE CAN DO IT JUST THINK ]
// +----------------------------------------------------------------------
// | Copyright (c) 2006~2018 http://thinkphp.cn All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author: liu21st <liu21st@gmail.com>
// +----------------------------------------------------------------------
use think\facade\Route;

Route::rule('user/getMyLianxiList', 'User/getMyLianxiList')->middleware(['JwtAuth']);
Route::rule('user/dec_teach_DialNum', 'User/dec_teach_DialNum')->middleware(['JwtAuth']);
Route::rule('user/getTeacheOrder', 'User/getTeacheOrder')->middleware(['JwtAuth']);
Route::rule('user/getUserInfo', 'User/getUserInfo')->middleware(['JwtAuth']);
Route::rule('user/updateUserInfo', 'User/updateUserInfo')->middleware(['JwtAuth']);
Route::rule('user/studentsRelease', 'User/studentsRelease')->middleware(['JwtAuth']);
Route::rule('user/getMyCommentList', 'User/getMyCommentList')->middleware(['JwtAuth']);
Route::rule('user/feedback', 'User/feedback')->middleware(['JwtAuth']);
Route::rule('user/logout', 'User/logout')->middleware(['JwtAuth']);
Route::rule('user/addComment', 'User/addComment')->middleware(['JwtAuth']);
Route::rule('user/getMyCollectList', 'User/getMyCollectList')->middleware(['JwtAuth']);
Route::rule('user/teacherReg', 'User/teacherReg')->middleware(['JwtAuth']);
Route::rule('user/addOrCancelCollect', 'User/addOrCancelCollect')->middleware(['JwtAuth']);
Route::rule('user/addAppointment', 'User/addAppointment')->middleware(['JwtAuth']);
Route::rule('user/refreshCv', 'User/refreshCv')->middleware(['JwtAuth']);
Route::rule('user/getTeacherAppointmentList', 'User/getTeacherAppointmentList')->middleware(['JwtAuth']);
Route::rule('user/getStuDemandList', 'User/getStuDemandList')->middleware(['JwtAuth']);
Route::rule('user/getDelDemand', 'User/getDelDemand')->middleware(['JwtAuth']);
Route::rule('user/hideOrOpenResume', 'User/hideOrOpenResume')->middleware(['JwtAuth']);
Route::rule('user/teacherOffProfile', 'User/teacherOffProfile')->middleware(['JwtAuth']);
Route::rule('user/getMsgInfo', 'User/getMsgInfo')->middleware(['JwtAuth']);
Route::rule('user/addIsRead', 'User/addIsRead')->middleware(['JwtAuth']);
Route::rule('user/getMsgList', 'User/getMsgList')->middleware(['JwtAuth']);
Route::rule('user/getMyFileList', 'User/getMyFileList')->middleware(['JwtAuth']);
Route::rule('user/uploadFile', 'User/uploadFile')->middleware(['JwtAuth']);
Route::rule('user/accountCancellation', 'User/accountCancellation')->middleware(['JwtAuth']);
Route::rule('user/teacherVipCost', 'User/teacherVipCost')->middleware(['JwtAuth']);
Route::rule('demand/getUserDemandHistoryPage', 'Demand/getUserDemandHistoryPage')->middleware(['JwtAuth']);
Route::rule('demand/getDemandTeacherViewHistory', 'Demand/getDemandTeacherViewHistory')->middleware(['JwtAuth']);
Route::rule('index/getBookInfo', 'Index/getBookInfo')->middleware(['JwtAuth']);
//Route::rule('index/getTeacherInfo', 'Index/getTeacherInfo')->middleware(['JwtAuth']);
//Route::rule('index/getStudentInfo', 'Index/getStudentInfo')->middleware(['JwtAuth']);
Route::rule('index/qryIsLook', 'Index/qryIsLook')->middleware(['JwtAuth']);
Route::rule('order/createOrder', 'Order/createOrder')->middleware(['JwtAuth']);
Route::rule('order/createTcOrder', 'Order/createTcOrder')->middleware(['JwtAuth']);
Route::rule('order/getOrderList', 'Order/getOrderList')->middleware(['JwtAuth']);
Route::rule('order/getStuOrderList', 'Order/getStuOrderList')->middleware(['JwtAuth']);
Route::rule('order/getTeaOrderList', 'Order/getTeaOrderList')->middleware(['JwtAuth']);
Route::rule('order/createHelpOrder', 'Order/createHelpOrder')->middleware(['JwtAuth']);
Route::rule('order/wxPay', 'Order/wxPay')->middleware(['JwtAuth']);
Route::rule('order/createBackOnlineOrder', 'Order/createBackOnlineOrder')->middleware(['JwtAuth']);
Route::rule('order/demandWxPay', 'Order/demandWxPay')->middleware(['JwtAuth']);
Route::rule('order/wxPayAppointment', 'Order/wxPayAppointment')->middleware(['JwtAuth']);
Route::rule('order/reduceOrderHours', 'Order/reduceOrderHours')->middleware(['JwtAuth']);
Route::rule('order/msgConfirmOrCancel', 'Order/msgConfirmOrCancel')->middleware(['JwtAuth']);
Route::rule('order/createFileDownloadOrder', 'Order/createFileDownloadOrder')->middleware(['JwtAuth']);
Route::rule('order/wxPayFileDownloadOrder', 'Order/wxPayFileDownloadOrder')->middleware(['JwtAuth']);
Route::rule('order/createDialOrder', 'Order/createDialOrder')->middleware(['JwtAuth']);
Route::rule('demand/refreshDemand', 'Demand/refreshDemand')->middleware(['JwtAuth']);
Route::rule('demand/hideOrShowDemand', 'Demand/hideOrShowDemand')->middleware(['JwtAuth']);
Route::rule('demand/confirmFinish', 'Demand/confirmFinish')->middleware(['JwtAuth']);
Route::rule('demand/contactDemand', 'Demand/contactDemand')->middleware(['JwtAuth']);
Route::rule('demand/contactTeacher', 'Demand/contactTeacher')->middleware(['JwtAuth']);
Route::rule('demand/applyRefundDemand', 'Demand/applyRefundDemand')->middleware(['JwtAuth']);
Route::rule('order/teacherOrderRefund', 'order/teacherOrderRefund')->middleware(['JwtAuth']);
Route::rule('uploadImg', 'index/uploadImg');
