<?php

//接口路由文件

use think\facade\Route;

Route::rule('about/:class_id','cms/About/index');
Route::rule('view/:content_id','cms/View/index');


Route::rule('teacher/register','cms/teacher/register');
Route::rule('teacher/teacherReg','cms/teacher/teacherReg');
Route::rule('teacher/getTeacherList','cms/teacher/getTeacherList');
Route::rule('teacher/teacherInfo','cms/teacher/teacherInfo');
Route::rule('teacher/refreshCv','cms/teacher/refreshCv');
Route::rule('teacher/hideOrOpenResume','cms/teacher/hideOrOpenResume');
Route::rule('teacher/myResume','cms/teacher/myResume');
Route::rule('teacher/getSetMeal','cms/teacher/getSetMeal');
Route::rule('teacher/yyOrder','cms/teacher/yyOrder');
Route::rule('teacher/myOrder','cms/teacher/myOrder');
Route::rule('teacher/teacherCommentList','cms/teacher/teacherCommentList');
Route::rule('teacher/stickComment','cms/teacher/stickComment');
Route::rule('teacher/getTakeOrderSm','cms/teacher/getTakeOrderSm');
Route::rule('teacher/createTcOrder','cms/teacher/createTcOrder');
Route::rule('teacher/updateResume','cms/teacher/updateResume');
Route::rule('teacher/resumeView','cms/teacher/resumeView');
Route::rule('teacher/updateOrderStatus','cms/teacher/updateOrderStatus');

Route::rule('teacher/:teacher_id','cms/teacher/teacherInfo');
Route::rule('teacher/','cms/teacher/index');

Route::rule('news/:content_id','cms/news/index');


Route::rule('student/release','cms/student/release');
Route::rule('student/studentsRelease','cms/student/studentsRelease');
Route::rule('student/getStudentList','cms/student/getStudentList');
Route::rule('student/getMyCommentList','cms/student/getMyCommentList');
Route::rule('student/addComment','cms/student/addComment');
Route::rule('student/addAppointment','cms/student/addAppointment');
Route::rule('student/getStuAppointmentList','cms/student/getStuAppointmentList');
Route::rule('student/getStuDemandList','cms/student/getStuDemandList');
Route::rule('student/getDelDemand','cms/student/getDelDemand');
Route::rule('student/getDemandTeacherList','cms/student/getDemandTeacherList');

Route::rule('student/:demand_id','cms/student/studentInfo');
Route::rule('student/','cms/student/index');