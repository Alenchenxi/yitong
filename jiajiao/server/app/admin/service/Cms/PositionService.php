<?php 
namespace app\admin\service\Cms;
use app\admin\model\Cms\Position;
use think\exception\ValidateException;
use xhadmin\CommonService;

class PositionService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$orderby,$limit,$page){
		try{
			$res = Position::where($where)->order($orderby)->paginate(['list_rows'=>$limit,'page'=>$page]);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res->items(),'total'=>$res->total()];
	}


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		if(empty($data['title'])) throw new ValidateException('名称不能为空');
		try{
			$res = Position::create($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res->id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		if(empty($data['title'])) throw new ValidateException('名称不能为空');
		try{
			$res = Position::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res;
	}




}

