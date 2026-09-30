<?php

namespace app\admin\controller\Sys;
use app\admin\controller\Sys\service\MenuService;
use app\admin\controller\Sys\model\Menu as MenuModel;
use app\admin\controller\Sys\model\Field;
use app\admin\controller\Sys\model\Action;
use app\admin\controller\Sys\model\Application;
use app\admin\controller\Admin;
use think\facade\Db;

class Menu extends Admin
{
	
	public function initialize(){
		parent::initialize();
		config(['view_path'=>app_path()],'view');
	}
	
	private function getTpl($app_id,$extend){
		$applicationInfo = Application::find($app_id);
		switch($applicationInfo['app_type']){
			case 1:
				$tpl = 'controller/Sys/view/menu/admin_'.$extend;
			break;
			
			case 2:
				$tpl = 'controller/Sys/view/menu/api_'.$extend;
			break;
			
			case 3:
				$tpl = 'controller/Sys/view/menu/cms_'.$extend;
			break;
		}
		
		return $tpl;
	}
	
	
	public function getTableList(){
		$connect = $this->request->param('connect');
		if(empty($connect)) $connect = config('database.default');
		$list = Db::connect($connect)->query('show tables');
		foreach($list as $k=>$v){
			$tableList[] = str_replace(config('database.connections.'.$connect.'.prefix'),'',$v['Tables_in_'.config('database.connections.'.$connect.'.database')]);
		}
		$no_show_table = ['application','menu','config','role','upload_config','action','access','field','log','user'];
		foreach($tableList as $key=>$val){
			if(in_array($val,$no_show_table)){
				unset($tableList[$key]);
			}
		}
		return json(array_values($tableList));
	}
	
    public function index(){	   
	   if (!$this->request->isAjax()){
		    $app_id = $this->request->get('app_id',1,'intval');
			$this->view->assign('app_id',$app_id);
			$this->view->assign('databaseList',config('database.connections'));
			return view($this->getTpl($app_id,'index'));
		}else{
			$limit  = input('post.limit', 20, 'intval');
			$offset = input('post.offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;
			
			$app_id = $this->request->get('app_id','','intval');

			$limit = ($page-1) * $limit.','.$limit;
			try{
				$data['rows'] = MenuModel::where('app_id',$app_id)->order('sortid asc')->select();
				$data['total'] = MenuModel::where('app_id',$app_id)->order('sortid asc')->count();
			}catch(\Exception $e){
				exit($e->getMessage());
			}
			$data['rows']  = formartList(['menu_id', 'pid', 'title','cname'],$data['rows']);

			return json($data);
		}
    }
	
	public function add(){
		if (!$this->request->isPost()){
			$app_id = $this->request->get('app_id','','intval');
			if(!$app_id) $this->error('参数错误');
			$this->view->assign('menuList',formartList(['menu_id','pid','title','title'],MenuModel::where(['app_id'=>$app_id])->select()));
			$this->view->assign('app_id',$app_id);
			return view($this->getTpl($app_id,'info'));
		}else{
			$data = input('post.');
			try{
				MenuService::saveData('add',$data);
			} catch (\Exception $e) {
				$this->error($e->getMessage());
			}
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}
	
	public function update(){
		if (!$this->request->isPost()){
			$menu_id = $this->request->get('menu_id','','intval');
			if(!$menu_id) $this->error('参数错误');
			$info = MenuModel::find($menu_id);
			$this->view->assign('info',$info);
			$this->view->assign('menuList',formartList(['menu_id','pid','title','title'],MenuModel::where(['app_id'=>$info['app_id']])->select()));
			$this->view->assign('app_id',$info['app_id']);
			return view($this->getTpl($info['app_id'],'info'));
		}else{
			$data = input('post.');
			try{
				MenuService::saveData('edit',$data);
			} catch (\Exception $e) {
				$this->error($e->getMessage());
			}
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}
	
	//更新排序
	public function setSort(){
		$id = $this->request->post('id','','intval');
		$sortid = $this->request->post('sortid','','intval');
		if(!$id || !$sortid) $this->error('参数错误');

		try{
			MenuModel::update(['menu_id'=>$id,'sortid'=>$sortid]);
		} catch (\Exception $e) {
			$this->error($e->getMessage());
		}
		return json(['status'=>'00','msg'=>'修改成功']);
	}
	
	//箭头排序
	public function arrowsort(){
		$id = $this->request->post('menu_id','','intval');
		$type = $this->request->post('type','','intval');		
		if(!$id || !$type) $this->error('参数错误');	
		try{
			MenuService::arrowsort($id,$type);
		}catch(\Exception $e){
			$this->error($e->getMessage());
		}
		return json(['status'=>'00','msg'=>'设置成功']);
	}
	
	/*修改排序、开关按钮操作 如果没有此类操作 可以删除该方法*/
	function updateExt(){
		$data = $this->request->post();
		if(!$data['menu_id']) $this->error('参数错误');
		try{
			MenuModel::update($data);
		}catch(\Exception $e){
			$this->error($e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	//卸载业务模块
	public function delete(){
		$menu_id = $this->request->post('menu_id','','intval');
		if(!$menu_id) $this->error('参数错误');
		
		try{
			$res = MenuModel::destroy($menu_id);
		} catch (\Exception $e) {
			$this->error($e->getMessage());
		}
		return json(['status'=>'00','msg'=>'删除成功']);
	}
	
	//复制菜单
	public function copyMenu(){
		$app_id  = $this->request->post('app_id', '', 'intval');
		$menu_id  = $this->request->post('menu_id', '', 'intval');
		
		if(!$app_id || !$menu_id) throw new \Exception('参数错误');
		try{
			$menuInfo = MenuModel::find($menu_id)->toArray();
			$applicationInfo = Application::find($app_id)->toArray();
			
			$menuInfo['table_status'] = 0;
			$table_name = $menuInfo['table_name'];
			$target_table_name = 'ext_'.$menuInfo['table_name'];
			
			$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
			
			if($applicationInfo['app_id'] == 1){
				$tables = Db::connect($connect)->query('show tables');
				foreach($tables as $k=>$v){
					$tableList[] = str_replace(config('database.connections.'.$connect.'.prefix'),'',$v['Tables_in_'.config('database.connections.'.$connect.'.database')]);
				}
				if(in_array($target_table_name,$tableList)){
					throw new \Exception($target_table_name.'数据表已经存在');
				}
			}
			
			if($menuInfo['app_id'] == $app_id){
				$menuInfo['table_name'] = $target_table_name;
				$menuInfo['controller_name'] = $menuInfo['controller_name'].'Ext';
				$menuInfo['table_status'] = 1;
			}
			$target_appid = $menuInfo['app_id'];
			$menuInfo['app_id'] = $app_id;
			

			$menuInfo['pid'] = 0;
			unset($menuInfo['menu_id']);
			$res = db("menu")->insertGetId($menuInfo);
			
			$fieldList = Field::where(['menu_id'=>$menu_id])->select()->toArray();
			if($fieldList){
				foreach($fieldList as $key=>$val){
					unset($val['id']);
					$val['menu_id'] = $res;
					if($target_appid == $app_id){
						$val['is_field'] = 1;
					}else{
						$val['is_field'] = 0;
					}
					Field::create($val);
				}
			}
			
			$actionList = Action::where(['menu_id'=>$menu_id])->select()->toArray();
			if($actionList){
				foreach($actionList as $key=>$val){
					unset($val['id']);
					$val['menu_id'] = $res;
					$val['log_status'] = 1;
					if($applicationInfo['app_type'] == 2 && $val['type'] <> 6){
						$val['remark'] = '';
					}
					if($applicationInfo['app_type'] == 1){
						Action::create($val);
					}elseif($applicationInfo['app_type'] == 2){
						if($val['type'] <> 16){
							Action::create($val);
						}
					}	
				}
			}
			if($applicationInfo['app_id'] == 1){
				Db::connect($connect)->execute('CREATE TABLE '.config('database.connections.'.$connect.'.prefix').$target_table_name.' SELECT * FROM '.config('database.connections.'.$connect.'.prefix').$table_name.' WHERE 1=2');
				Db::connect($connect)->execute("ALTER TABLE ".config('database.connections.'.$connect.'.prefix')."{$target_table_name} CHANGE {$menuInfo['pk_id']} {$menuInfo['pk_id']} int(11) COMMENT '编号' NOT NULL AUTO_INCREMENT PRIMARY KEY");
			}
			
		}catch(\Exception $e){
			return json(['status'=>'01','msg'=>$e->getMessage()]);
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	
	//通过数据表直接生成模块
	public function createModuleByTable(){
		try{
			$table_name = $this->request->post('table_name');
			$connect = $this->request->post('connect');
			if(!$table_name) throw new \Exception('请选择数据表');
			
			if(empty($connect)){
				$connect = config('database.default');
			}
			
			$list = Db::connect($connect)->query('show full columns from '.config('database.connections.'.$connect.'.prefix').$table_name);
			if(!$list) throw new \Exception('数据表不存在');
			
			foreach($list as $key=>$val){
				if($val['Extra'] == 'auto_increment' || $val['Key'] == 'PRI'){
					$pk_id = $val['Field'];
				}
			}
			
			if(empty($pk_id)){
				return json(['status'=>'01','msg'=>'当前数据表缺少自增的主键']);
			}
			
			//第一步创建菜单
			$menu['controller_name'] = str_replace('_','',$table_name);
			$menu['title']	= $table_name;
			$menu['table_name'] = $table_name;
			$menu['pk_id'] = $pk_id;
			$menu['is_create'] = 1;
			$menu['table_status'] = 0;
			$menu['status'] = 1;
			$menu['app_id'] = 1;
			$menu['connect'] = $connect;
			
			$menu_id = MenuService::saveData('add',$menu);
			Field::where(['menu_id'=>$menu_id,'name'=>'编号'])->update(['is_field'=>0]);
			
			//第二步创建字段
			foreach($list as $key=>$val){
				if($val['Extra'] <> 'auto_increment' && $val['Key'] <> 'PRI'){
					$field['menu_id'] = $menu_id;
					$field['name'] = !empty($val['Comment']) ? $val['Comment'] : $val['Field'];
					$field['field'] = $val['Field'];
					$field['type'] = 1;
					$field['list_show'] = 1;
					$field['search_show'] = 1;
					$field['search_type'] = 0;
					$field['is_post'] = 1;
					$field['is_field'] = 0;
					$field['align'] = 'center';
					$field['datatype'] = explode('(',$val['Type'])[0];
					$field['length'] = explode(',',explode(')',explode('(',$val['Type'])[1])[0])[0];
					$res = Field::create($field);
					if($res->id){
						Field::where('id',$res->id)->update(['sortid'=>$res->id]);
					}
				}
			}
				
			//第三部创建方法
			$action['actions'] = '添加|add|3|fa fa-plus,修改|update|4|fa fa-pencil,删除|delete|5|fa fa-trash,查看详情|view|15|fa fa-plus';
			$action['menu_id'] = $menu_id;
			\app\admin\controller\Sys\service\ActionService::addFast($action);
		}catch(\Exception $e){
			return json(['status'=>'01','msg'=>$e->getMessage()]);
		}
		return json(['status'=>'00','menu_id'=>$menu_id,'msg'=>'操作成功']);
	}
	
	
	
	
}
