<?php

namespace app\admin\controller\Sys\service;

class ActionSetService
{
	
	public static function actionList(){
		
		$list=[
			1 => '数据列表',
			3 => '添加',
			4 => '修改',
			5 => '删除',
			6 => '设置指定值 如修改状态',
			16=> '修改排序、或开关操作',
			7 => '数值加',
			8 => '数值减',
			9 => '重置密码',
			10=> '跳转链接',
			11=> '弹窗链接',
			12=> '数据导出',
			13=> '数据导入',
			14=> '批量修改',
			15=> '查看详情',
			30=> '箭头排序',
			31=> '软删除',
			32=> '回收站',
			33=> '回收站数据删除',
			34=> '回收站数据还原',
		];
		
        return $list;
	}
	
	public static function apiList(){		
		$list=[
			1 => '数据列表',
			3 => '添加',
			4 => '修改',
			5 => '删除',
			6 => '设置指定值 如修改状态',
			7 => '数值加',
			8 => '数值减',
			9 => '重置密码',
			12=> '数据导出',
			15=> '查看数据',
			17=> '账号密码登录',
			19=> '手机号登录',
			18=> '发送短信验证码',
			31=> '软删除',
			32=> '回收站',
			33=> '回收站数据删除',
			34=> '回收站数据还原',
		];
		
        return $list;
	}
	
	
	
	//接口请求方式
	public static function requestList(){
		
		$list=['post','get','delete','put','header'];
		
        return $list;
	}
	
	
}
