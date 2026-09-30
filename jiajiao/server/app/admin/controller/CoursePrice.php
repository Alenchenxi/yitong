<?php 
/*
 module:		科目价格
 create_time:	2022-10-13 20:19:45
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\CoursePriceService;
use app\admin\model\CoursePrice as CoursePriceModel;
use think\facade\Db;

class CoursePrice extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.name'] = ['like',$this->request->param('name_s', '', 'serach_in')];
			$where['a.type_id'] = $this->request->param('type_id', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'course_price_id desc';

			$sql = 'select a.*,b.name as type_name from cd_course_price a left join cd_type b on a.type_id=b.type_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'name,dxs_price,pt_price,zy_price,type_id';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = CoursePriceService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$course_price_id = $this->request->get('course_price_id','','serach_in');
			if(!$course_price_id) $this->error('参数错误');
			$this->view->assign('info',checkData(CoursePriceModel::find($course_price_id)));
			return view('update');
		}else{
			$postField = 'course_price_id,name,dxs_price,pt_price,zy_price,type_id';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = CoursePriceService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('course_price_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			CoursePriceModel::destroy(['course_price_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

