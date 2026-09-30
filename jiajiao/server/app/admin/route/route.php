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

Route::post('Sys.Menu/add', 'Sys.Menu/add')->middleware(['SetTable']);	//创建数据表
Route::post('Sys.Menu/update', 'Sys.Menu/update')->middleware('UpTable');	//更新数据表
Route::post('Sys.Menu/delete', 'Sys.Menu/delete')->middleware('DeleteMenu');	//删除菜单
Route::post('Sys.Field/add', 'Sys.Field/add')->middleware('SetField');	//创建字段
Route::post('Sys.Field/update', 'Sys.Field/update')->middleware('UpField');	//修改字段
Route::post('Sys.Field/delete', 'Sys.Field/delete')->middleware('DeleteField');	//删除字段
Route::post('Sys.Application/delete', 'Sys.Application/delete')->middleware('DeleteApplication');	//删除应用
