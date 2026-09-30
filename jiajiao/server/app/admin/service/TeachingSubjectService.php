<?php 
/*
 module:		授教科目
 create_time:	2023-05-25 15:00:46
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\TeachingSubject;
use think\exception\ValidateException;
use xhadmin\CommonService;

class TeachingSubjectService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = TeachingSubject::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$res = TeachingSubject::update($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res;
	}




}

