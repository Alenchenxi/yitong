<?php
/**
 * 生成代码
 * ============================================================================
 * * COPYRIGHT 2016-2019 xhadmin.com , and all rights reserved.
 * * WEBSITE: http://www.xhadmin.com;
 * ----------------------------------------------------------------------------
 * This is not a free software!You have not used for commercial purposes in the
 * premise of the program code to modify and use; and publication does not allow
 * any form of code for any purpose.
 * ============================================================================
 * Author: 寒塘冷月 QQ：274363574
 */
 
namespace app\admin\controller\Sys;
use app\admin\controller\Sys\model\Menu;
use app\admin\controller\Sys\model\Application;
use app\admin\controller\Sys\model\Action;
use app\admin\controller\Sys\model\Field;
use app\admin\controller\Sys\service\BuildService;
use app\admin\controller\Sys\service\FieldSetService;
use app\admin\controller\Sys\service\ExtendService;
use app\admin\controller\Admin;


class Build extends Admin
{
	
	
	//判断是生成后台业务模块 还是api
	public function create(){
		$menu_id = $this->request->post('menu_id','','intval');
		$actionList = Action::where('menu_id',$menu_id)->order('sortid asc')->select()->toArray();
		$menuInfo = Menu::find($menu_id); //菜单信息
		$applicationInfo = Application::find($menuInfo['app_id']); //应用信息
		if($applicationInfo['app_type'] == 1){
			if($menuInfo['menu_id'] == config('my.config_module_id')){
				self::createConfig($applicationInfo,$menuInfo);
				return json(['status'=>'00','msg'=>'生成成功']);
			}else{
				if(!$menuInfo || !$applicationInfo || empty($menuInfo['controller_name'])){
					return json(['status'=>'01','msg'=>'菜单信息错误']);
				}
				if($menuInfo['is_create'] && $this->createAdminModule($menuInfo,$applicationInfo,$actionList)){
					return json(['status'=>'00','msg'=>'生成成功']);
				}
			}
		}else{
			if($menuInfo['is_create'] && $this->createApiModule($menuInfo,$applicationInfo,$actionList)){
				return json(['status'=>'00','msg'=>'生成成功']);
			}
		}
	}
	
	/**
     * 生成后台业务模块
     * @param string $menu_id
     * @throws \Exception
     * @return bool
     */
	public function createAdminModule($menuInfo,$applicationInfo,$actionList){
		$menu_id = $menuInfo['menu_id'];
		$pk_id = $menuInfo['pk_id'];
		$str .= "<?php \n";
		!is_null(config('my.comment.file_comment')) ? config('my.comment.file_comment') : true;
		if(config('my.comment.file_comment')){
		$str .= "/*\n";
		$str .= " module:		".$menuInfo['title']."\n";
		$str .= " create_time:	".date('Y-m-d H:i:s')."\n";
		$str .= " author:		".config('my.comment.author')."\n";
		$str .= " contact:		".config('my.comment.contact')."\n";
		$str .= "*/\n\n";
		}
		$str .= "namespace app\\".$applicationInfo['app_dir']."\controller".getDbName($menuInfo['controller_name']).";\n\n";
		$str .= "use app\\".$applicationInfo['app_dir']."\\service\\".getUseName($menuInfo['controller_name'])."Service;\n";
		$str .= "use app\\".$applicationInfo['app_dir']."\\model\\".getUseName($menuInfo['controller_name'])." as ".getControllerName($menuInfo['controller_name'])."Model;\n";
		if(strpos($menuInfo['controller_name'],'/') > 0){
			$str .= "use app\\".$applicationInfo['app_dir']."\\controller\Admin;\n";
		}
		$str .="use think\\facade\\Db;\n";
		$str .="\n";
		$str .= "class ".getControllerName($menuInfo['controller_name'])." extends Admin {\n\n\n";
		
		$fieldList = Field::where(['menu_id'=>$menu_id])->order('sortid asc')->select();
		
		//判断添加操作是否有session
		foreach($fieldList as $k=>$v){
			if($v['type'] == 15 && $v['search_show'] == 1){
				$session_field = $v['field'];
			}
			if(in_array($v['type'],[22,23])){
				$updateExt_field .= ','.$v['field'];
			}
			if($v['type'] == 14){
				$hiden_fileld = true;
			}
			
			$postFields[] = $v['field'];
		}
		$addInfo = Action::where(['type'=>3,'menu_id'=>$menu_id])->find();
		foreach($actionList as $m=>$n){
			if(in_array($n['type'],[4,5,6,16,7,8,9,15])){
				$action_auth .= '\''.$n['action_name'].'\',';
			}
		}
		
		if($session_field && in_array($session_field,explode(',',$addInfo['fields'])) && $action_auth){
			$str .="	function initialize(){\n";
			$str .="		parent::initialize();\n";
			$str .="		if(in_array(\$this->request->action(),[".rtrim($action_auth,',')."])){\n";
			$str .="			\$idx = \$this->request->param('".$pk_id."','','serach_in');\n";
			$str .="			if(\$idx){\n";
			$str .="				foreach(explode(',',\$idx) as \$v){\n";
			$str .="					\$info = ".getControllerName($menuInfo['controller_name'])."Model::find(\$v);\n";
			if($applicationInfo['app_id'] == 1){
				$str .="					if(session('".$applicationInfo['app_dir'].".role_id') <> 1 && \$info['".$session_field."'] <> session('".$applicationInfo['app_dir'].".".$session_field."')) \$this->error('你没有操作权限');\n";
			}else{
				$str .="					if(\$info['".$session_field."'] <> session('".$applicationInfo['app_dir'].".".$session_field."')) \$this->error('你没有操作权限');\n";
			}
			$str .="				}\n";
			$str .="			}\n";
			$str .="		}\n";
			$str .="	}\n\n";
		}
		
		foreach($actionList as $key=>$val){
			switch($val['type']){	
				//数据列表
				case (in_array($val['type'],[1,32])):
					$fieldList = Field::where(['menu_id'=>$menu_id])->order('sortid asc')->select();
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .= "		if (!\$this->request->isAjax()){\n";
						$str .="			return view('".$val['action_name']."');\n";
						$str .="		}else{\n";
						$str .="			\$limit  = \$this->request->post('limit', 20, 'intval');\n";
						$str .="			\$offset = \$this->request->post('offset', 0, 'intval');\n";
						$str .="			\$page   = floor(\$offset / \$limit) +1 ;\n\n";
						
						
						if($fieldList){
							$pre = '';
							$str .="			\$where = [];\n";
							if(($val['relate_table'] && $val['relate_field']) || strpos(strtolower($val['sql_query']),'join') > 0){
								$pre = 'a.';
								$softDeleteAction =  db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>31])->value('action_name');
								if($softDeleteAction){
									if($val['type'] == 1){
										$str .="			\$where['".$pre."delete_time'] = ['exp','is null'];\n";
									}
									if($val['type'] == 32){
										$str .="			\$where['".$pre."delete_time'] = ['exp','is not null'];\n";
									}
								}
							}
							
							foreach($fieldList as $k=>$v){
								if(($v['search_show'] == 1 && in_array($v['type'],[1,2,3,4,6,7,12,13,15,17,20,21,23,27,28,29,30])) || $v['type'] == 14){
									if($v['type'] ==  4){
										$str .="\n"; 
										$str .="			\$where['".$pre."".$v['field']."'] = ['find in set',\$this->request->param('".$v['field']."', '', 'serach_in')];\n";
									}elseif($v['type'] ==  7){
										$str .="\n"; 
										$str .="			\$".$v['field']."_start = \$this->request->param('".$v['field']."_start', '', 'serach_in');\n";
										$str .="			\$".$v['field']."_end = \$this->request->param('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="			\$where['".$pre."".$v['field']."'] = ['between',[strtotime(\$".$v['field']."_start),strtotime(\$".$v['field']."_end)]];\n";
									}elseif($v['type'] ==  12){
										$str .="\n"; 
										$str .="			\$".$v['field']."_start = \$this->request->param('".$v['field']."_start', '', 'serach_in');\n";
										$str .="			\$".$v['field']."_end = \$this->request->param('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="			\$where['".$pre."".$v['field']."'] = ['between',[strtotime(\$".$v['field']."_start),strtotime(\$".$v['field']."_end)]];\n";
									}elseif($v['type'] ==  13){
										$str .="\n"; 
										$str .="			\$".$v['field']."_start = \$this->request->param('".$v['field']."_start', '', 'serach_in');\n";
										$str .="			\$".$v['field']."_end = \$this->request->param('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="			\$where['".$pre."".$v['field']."'] = ['between',[\$".$v['field']."_start,\$".$v['field']."_end]];\n";
									}elseif($v['type'] == 15){
										if($applicationInfo['app_id'] == 1){
											$str .="			if(session('".$applicationInfo['app_dir'].".role_id') <> 1){\n";
											$str .="				\$where['".$pre."".$v['field']."'] = session('".$applicationInfo['app_dir'].'.'.$v['field']."');\n";
											$str .="			}\n";
										}else{
											$str .="			\$where['".$pre."".$v['field']."'] = session('".$applicationInfo['app_dir'].'.'.$v['field']."');\n";
										}
									}elseif($v['type'] == 17){
										foreach(explode('|',$v['field']) as $m=>$n){
											$str .="			\$where['".$pre."".$n."'] = \$this->request->param('".$n."', '', 'serach_in');\n";
										}
									}elseif($v['type'] ==  27){
										$str .="\n"; 
										$str .="			\$where['".$pre."".$v['field']."'] = ['find in set',\$this->request->param('".$v['field']."', '', 'serach_in')];\n";
									}else{
										if($v['field'] == 'name'){
											$search_field = 'name_s';
										}else{
											$search_field = $v['field'];
										}
										if($v['search_type']){
											$str .="			\$where['".$pre."".$v['field']."'] = ['like',\$this->request->param('".$search_field."', '', 'serach_in')];\n";
										}else{
											$str .="			\$where['".$pre."".$v['field']."'] = \$this->request->param('".$search_field."', '', 'serach_in');\n";
										}	
									}

								}
								$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
								if(in_array($v['list_show'],[1,2]) && BuildService::getFieldStatus($v['field'],$menuInfo['table_name'],$connect)){
									$list_fields .= str_replace('|',',',$v['field']).',';
								}
							}
						}
						
						
						
						if(!empty($val['tree_config'])){
							$list_fields = '*';
						}
						
						$str .= "\n";
						$str .="			\$order  = \$this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入\n";
						$str .="			\$sort  = \$this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc\n";
						$str .= "\n";
						if(!empty($val['sql_query'])){
							$list_fields = '';
						}else{
							if(!empty($val['relate_table']) && !empty($val['relate_field']) && !empty($val['fields'])){
								$list_fields = $val['list_field'];
							}else{
								$list_fields = rtrim($list_fields,',');
							}
						}
						
						$str .="			\$field = '".$list_fields."';\n";
						$orderByField = $pk_id;
						$sortidField = db("field")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>22])->value('field');
						if($sortidField){
							$orderByField = $sortidField.' desc,'.$pk_id;
						}
						$orderby = !empty($val['default_orderby']) ? $val['default_orderby'] : $orderByField.' desc';
						$str .="			\$orderby = (\$sort && \$order) ? \$sort.' '.\$order : '".$orderby."';\n\n";
						
						//首先判断是否存在数据源
						if(!empty($val['sql_query'])){
							if(false == strpos($val['sql_query'],'.')){
								$val['sql_query'] = str_replace('\'','"',$val['sql_query']);
							}
							$str .="			\$sql = '".str_replace(array("\r\n", "\r", "\n"), " ",$val['sql_query'])."';\n";
							$str .="			\$limit = (\$page-1) * \$limit.','.\$limit;\n";
							if($menuInfo['connect']){
								$str .="			\$res = \xhadmin\CommonService::loadList(\$sql,formatWhere(\$where),\$limit,\$orderby,'".$menuInfo['connect']."');\n";
							}else{
								$str .="			\$res = \xhadmin\CommonService::loadList(\$sql,formatWhere(\$where),\$limit,\$orderby);\n";
							}
							
						}else{
							$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."List(formatWhere(\$where),\$field,\$orderby,\$limit,\$page);\n";
						}
						
						if(!empty($val['tree_config'])){
							$tree_config = explode(',',$val['tree_config']);
							$str .="			\$res['rows'] = formartList(['".$pk_id."', '".$tree_config[0]."', '".$tree_config[1]."','".$tree_config[1]."'],\$res['rows']);\n";
						}
						$str .="			return json(\$res);\n";
						$str .="		}\n";
						$str .="	}\n\n";
						$list_fields = '';
						$field = '';
					}
					
					
					
					if($val['is_view_create'] !== 0){
						$hszActionList = $actionList;
						$norActionList = $actionList;
						
						if($val['type'] == 32){
							foreach($fieldList as $m=>$n){
								if(in_array($n['type'],[22,23])){
									unset($fieldList[$m]);
								}
							}
							
							foreach($hszActionList as $k=>$v){
								if(!in_array($v['type'],[33,34])){
									unset($hszActionList[$k]);
								}
							}
							self::createIndexTpl($applicationInfo,$menuInfo,$val,$fieldList,$hszActionList); 
						}else{
							foreach($norActionList as $k=>$v){
								if(in_array($v['type'],[33,34])){
									unset($norActionList[$k]);
								}
							}
							self::createIndexTpl($applicationInfo,$menuInfo,$val,$fieldList,$norActionList); 
						}
						
					}
				break;
				
				
				
				//添加数据
				case 3:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (!\$this->request->isPost()){\n";
						$str .="			return view('".$val['action_name']."');\n";
						$str .="		}else{\n";
						//查询是否存在关联表
						$fieldList = Field::where(['menu_id'=>$menu_id,'is_post'=>1])->order('sortid asc')->order('sortid asc')->select()->toArray();
						$relateFields = '';
						if($val['relate_table'] && $val['relate_field']){
							$relateTableFieldList = BuildService::getRelateFieldList($val['relate_table']);
							$fieldList = array_merge($fieldList,$relateTableFieldList);
							foreach($relateTableFieldList as $k=>$v){
								if($v['is_post'] == 1){
									$relateFields .= $v['field'].',';
								}
							}
							$val['fields'] = $relateFields.$val['fields'];
						}
						
						$str .="			\$postField = '".str_replace('|',',',$val['fields'])."';\n";
						$str .="			\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$data);\n";
						$sortidField =  db("field")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>22])->value('field');
						if($sortidField){
						$str .="			if(\$res && empty(\$data['".$sortidField."'])){\n";
						$str .="				".getControllerName($menuInfo['controller_name'])."Model::update(['".$sortidField."'=>\$res,'".$pk_id."'=>\$res]);\n";
						$str .="			}\n";
						}
						$str .="			return json(['status'=>'00','msg'=>'添加成功']);\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					$relateFields = '';
					if($val['is_view_create'] !== 0){
						self::createInfoTpl($applicationInfo,$menuInfo,$val,BuildService::array_unset_tt($fieldList,'field')); 
					}
				break;
				
				//修改数据
				case 4:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (!\$this->request->isPost()){\n";
						$str .="			\$".$pk_id." = \$this->request->get('".$pk_id."','','serach_in');\n";
						$str .="			if(!$".$pk_id.") \$this->error('参数错误');\n";
						if(!empty($val['relate_table']) && !empty($val['relate_field'])){
							if(!$val['list_field']){
								$field = 'a.*,b.*';
							}else{
								$field = $val['list_field'];
							}
							$str .= "			\$info = db('".$menuInfo['table_name']."')->field('".$field."')->alias('a')->join('".$val['relate_table']." b','a.".$menuInfo['pk_id']."=b.".$pk_id."','left')->where('a.".$pk_id."',\$".$pk_id.")->find();\n";
							$str .="			\$this->view->assign('info',checkData(\$info));\n";
						}else{
							$str .="			\$this->view->assign('info',checkData(".getControllerName($menuInfo['controller_name'])."Model::find($".$pk_id.")));\n";
						}
						$str .="			return view('".$val['action_name']."');\n";
						$str .="		}else{\n";
						//查询是否存在关联表
						$fieldList = Field::where(['menu_id'=>$menu_id,'is_post'=>1])->order('sortid asc')->order('sortid asc')->select()->toArray();
						$relateFields = '';
						if($val['relate_table']){
							$relateTableFieldList = BuildService::getRelateFieldList($val['relate_table']);
							$fieldList = array_merge($fieldList,$relateTableFieldList);
							foreach($relateTableFieldList as $k=>$v){
								if($v['is_post'] == 1){
									$relateFields .= $v['field'].',';
								}
							}
							
							$val['fields'] = $relateFields.$val['fields'];
						}
						$str .="			\$postField = '".$menuInfo['pk_id'].",".str_replace('|',',',$val['fields'])."';\n";
						$str .="			\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$data);\n";
						$str .="			return json(['status'=>'00','msg'=>'修改成功']);\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					$relateFields = '';
					if($val['is_view_create'] !== 0){
						self::createInfoTpl($applicationInfo,$menuInfo,$val,BuildService::array_unset_tt($fieldList,'field')); 
					}
				break;
				
				//删除
				case (in_array($val['type'],[5,33])):
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .= "		\$idx =  \$this->request->post('".$pk_id."', '', 'serach_in');\n";
						$str .="		if(!\$idx) \$this->error('参数错误');\n";
						$str .="		try{\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Model::destroy(['".$pk_id."'=>explode(',',\$idx)],true);\n";
						if($val['relate_table'] && $val['relate_field']){
							$str .="			db('".$val['relate_table']."')->where(['".$pk_id."'=>explode(',',\$idx)])->delete();\n";
						}
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="	}\n\n";
					}
					
				break;
				
				//软删除
				case 31:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .= "		\$idx =  \$this->request->post('".$pk_id."', '', 'serach_in');\n";
						$str .="		if(!\$idx) \$this->error('参数错误');\n";
						$str .="		try{\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Model::destroy(['".$pk_id."'=>explode(',',\$idx)]);\n";
						if($val['relate_table'] && $val['relate_field']){
							$str .="			db('".$val['relate_table']."')->where(['".$pk_id."'=>explode(',',\$idx)])->delete();\n";
						}
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="	}\n\n";
					}
					
				break;
				
				//修改状态
				case 6:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .= "		\$idx =  \$this->request->post('".$pk_id."', '', 'serach_in');\n";
						$str .="		if(!\$idx) \$this->error('参数错误');\n";
						$str .="		try{\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Model::where(['".$pk_id."'=>explode(',',\$idx)])->update(['".$val['fields']."'=>'".$val['remark']."']);\n";
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="	}\n\n";
					}
					
				break;
				
				//数值加
				case 7:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (!\$this->request->isPost()){\n";
						$str .="			\$info['".$pk_id."'] = \$this->request->get('".$pk_id."','','serach_in');\n";
						$str .="			return view('".$val['action_name']."',['info'=>\$info]);\n";
						$str .="		}else{\n";
						$str .="			\$postField = '".$pk_id.",".$val['fields']."';\n";
						$str .="			\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .=$token_str;
						$str .= "			if(empty(\$data['".$pk_id."'])) \$this->error('参数错误');\n";
						$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(['".$pk_id."'=>explode(',',\$data['".$pk_id."'])],\$data);\n";
						$str .="			return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					
					if($val['is_view_create'] !== 0){
						//生成创建模板界面
						self::createInfoTpl($applicationInfo,$menuInfo,$val,Field::where(['menu_id'=>$menu_id,'is_post'=>1])->order('sortid asc')->select()); 
					}
				break;
				
				//数值减
				case 8:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (!\$this->request->isPost()){\n";
						$str .="			\$info['".$pk_id."'] = \$this->request->get('".$pk_id."','','serach_in');\n";
						$str .="			return view('".$val['action_name']."',['info'=>\$info]);\n";
						$str .="		}else{\n";
						$str .="			\$postField = '".$pk_id.",".$val['fields']."';\n";
						$str .="			\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .=$token_str;
						$str .= "			if(empty(\$data['".$pk_id."'])) \$this->error('参数错误');\n";
						$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(['".$pk_id."'=>explode(',',\$data['".$pk_id."'])],\$data);\n";
						$str .="			return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					
					if($val['is_view_create'] !== 0){
						//生成创建模板界面
						self::createInfoTpl($applicationInfo,$menuInfo,$val,Field::where(['menu_id'=>$menu_id,'is_post'=>1])->order('sortid asc')->select());
					}						
				break;
				
				//重置密码
				case 9:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (!\$this->request->isPost()){\n";
						$str .="			\$info['".$pk_id."'] = \$this->request->get('".$pk_id."','','serach_in');\n";
						$str .="			return view('".$val['action_name']."',['info'=>\$info]);\n";
						$str .="		}else{\n";
						$str .="			\$postField = '".$pk_id.','.$val['fields']."';\n";
						$str .="			\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="			if(empty(\$data['".$pk_id."'])) \$this->error('参数错误');\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$data);\n";
						$str .="			return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					
					if($val['is_view_create'] !== 0){
						//生成创建模板界面
						self::createInfoTpl($applicationInfo,$menuInfo,$val,Field::where(['menu_id'=>$menu_id,'is_post'=>1])->order('sortid asc')->select());
					}						
				break;
				
				//导出数据
				case 12:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						/*生成搜索条件*/
						$fieldList = Field::where(['menu_id'=>$menu_id])->order('sortid asc')->select();
						if($fieldList){
							$pre = '';
							$str .="		\$where = [];\n";
							if(($val['relate_table'] && $val['relate_field']) || strpos(strtolower($val['sql_query']),'join') > 0){
								$pre = 'a.';
								$softDeleteAction =  db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>31])->value('action_name');
								if($softDeleteAction){
									if($val['type'] == 12){
										$str .="		\$where['".$pre."delete_time'] = ['exp','is null'];\n";
									}
									if($val['type'] == 32){
										$str .="		\$where['".$pre."delete_time'] = ['exp','is not null'];\n";
									}
								}
							}
							
							foreach($fieldList as $k=>$v){
								if(($v['search_show'] == 1 && in_array($v['type'],[1,2,3,4,6,7,12,13,15,17,21,23,28,29,30])) || $v['type'] == 14){
									if($v['type'] ==  4){
										$str .="\n"; 
										$str .="		\$where['".$pre."".$v['field']."'] = ['find in set',\$this->request->param('".$v['field']."', '', 'serach_in')];\n";
									}elseif($v['type'] ==  7){
										$str .="\n"; 
										$str .="		\$".$v['field']."_start = \$this->request->param('".$v['field']."_start', '', 'serach_in');\n";
										$str .="		\$".$v['field']."_end = \$this->request->param('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="		\$where['".$pre."".$v['field']."'] = ['between',[strtotime(\$".$v['field']."_start),strtotime(\$".$v['field']."_end)]];\n";
									}elseif($v['type'] ==  12){
										$str .="\n"; 
										$str .="		\$".$v['field']."_start = \$this->request->param('".$v['field']."_start', '', 'serach_in');\n";
										$str .="		\$".$v['field']."_end = \$this->request->param('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="		\$where['".$pre."".$v['field']."'] = ['between',[strtotime(\$".$v['field']."_start),strtotime(\$".$v['field']."_end)]];\n";
									}elseif($v['type'] ==  13){
										$str .="\n"; 
										$str .="		\$".$v['field']."_start = \$this->request->param('".$v['field']."_start', '', 'serach_in');\n";
										$str .="		\$".$v['field']."_end = \$this->request->param('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="		\$where['".$pre."".$v['field']."'] = ['between',[\$".$v['field']."_start,\$".$v['field']."_end]];\n";
									}elseif($v['type'] == 15){
										if($applicationInfo['app_id'] == 1){
											$str .="		if(session('".$applicationInfo['app_dir'].".role_id') <> 1){\n";
											$str .="			\$where['".$pre."".$v['field']."'] = session('".$applicationInfo['app_dir'].'.'.$v['field']."');\n";
											$str .="		}\n";
										}else{
											$str .="		\$where['".$pre."".$v['field']."'] = session('".$applicationInfo['app_dir'].'.'.$v['field']."');\n";
										}
									}elseif($v['type'] == 17){
										foreach(explode('|',$v['field']) as $m=>$n){
											$str .="		\$where['".$pre."".$n."'] = \$this->request->param('".$n."', '', 'serach_in');\n";
										}
									}else{
										if($v['search_type']){
											$str .="		\$where['".$pre."".$v['field']."'] = ['like',\$this->request->param('".$v['field']."', '', 'serach_in')];\n";
										}else{
											$str .="		\$where['".$pre."".$v['field']."'] = \$this->request->param('".$v['field']."', '', 'serach_in');\n";
										}	
									}
								}							
							}
						}
						
						$str .="		\$where['".$pre."".$pk_id."'] = ['in',\$this->request->param('".$pk_id."', '', 'serach_in')];\n";
						$str .="\n";
						$orderby = !empty($val['default_orderby']) ? $val['default_orderby'] : $pk_id.' desc';
						
						$str .="		try {\n";
						if(empty($val['relate_table']) && empty($val['relate_field']) && empty($val['sql_query'])){
							$str .="			//此处读取前端传过来的 表格勾选的显示字段\n";
							$str .="			\$fieldInfo = [];\n";
							$str .="			for(\$j=0; \$j<100;\$j++){\n";
							$str .="				\$fieldInfo[] = \$this->request->param(\$j);\n";
							$str .="			}\n";
							$str .="			\$list = ".getControllerName($menuInfo['controller_name'])."Model::where(formatWhere(\$where))->order('".$orderby."')->select();\n";
							$str .="			if(empty(\$list)) throw new Exception('没有数据');\n";
							$str .="			".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(htmlOutList(\$list),filterEmptyArray(array_unique(\$fieldInfo)));\n";
						}else{
							if(!empty($val['sql_query'])){
								$str .="			\$sql = '".$val['sql_query']."';\n";
								if($menuInfo['connect']){
									$str .= "			\$res = \xhadmin\CommonService::loadList(\$sql,formatWhere(\$where),config('my.max_dump_data'),\$orderby='','".$menuInfo['connect']."');\n";
								}else{
									$str .= "			\$res = \xhadmin\CommonService::loadList(\$sql,formatWhere(\$where),config('my.max_dump_data'),\$orderby='');\n";
								}
								
							}else{
								$str .= "			\$res['rows'] = db('".$menuInfo['table_name']."')->field('".$val['list_field']."')->alias('a')->join('".$val['relate_table']." b','a.".$val['fields']."=b.".$val['relate_field']."','left')->where(formatWhere(\$where))->limit(config('my.max_dump_data'))->order('".$orderby."')->select();\n";
							}
							$str .="			if(empty(\$res['rows'])) throw new Exception('没有数据');\n";
							$str .="			".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(htmlOutList(\$res['rows']));\n";
						}
						
						$str .="		} catch (\Exception \$e) {\n";
						$str .="			\$this->error(\$e->getMessage());\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					
				break;
				
				
				//导入数据
				case 13:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (\$this->request->isPost()) {\n";
						$str .="			try{\n";
						$str .="				\$key = '".getControllerName($menuInfo['controller_name'])."';\n";
						$str .="				\$result = \xhadmin\CommonService::importData(\$key);\n";
						$str .="				if (count(\$result) > 0) {\n";
						$str .="					cache(\$key,\$result,3600);\n";
						$str .="					return redirect('startImport');\n";
						$str .="				} else{\n";
						$str .="					\$this->error('内容格式有误！');\n";
						$str .="				}\n";
						$str .="			}catch(\Exception \$e){\n";
						$str .="				\$this->error(\$e->getMessage());\n";
						$str .="			}\n";
						$str .="		}else {\n";
						$str .="			return view('base/importData');\n";
						$str .="		}\n";
						$str .="	}\n\n";
						
						
						$str .="	//开始导入\n";
						$str .= "	function startImport(){\n";
						$str .="		if(!\$this->request->isPost()) {\n";
						$str .="			return view('base/startImport');\n";
						$str .="		}else{\n";
						$str .="			\$p = \$this->request->post('p', '', 'intval'); \n";
						$str .="			\$data = cache('".getControllerName($menuInfo['controller_name'])."');\n";
						$str .="			\$export_per_num = config('my.export_per_num') ? config('my.export_per_num') : 50;\n";
						$str .="			\$num = ceil((count(\$data)-1)/\$export_per_num);\n";
						if($val['fields']){
							$str .="			\$export_fields = '".$val['fields']."';	//支持导入的字段\n";
						}
						$str .="			if(\$data){\n";
						$str .="				\$start = \$p == 1 ? 2 : (\$p-1) * \$export_per_num + 1;\n";
						$str .="				if(\$data[\$start]){\n";
						$str .="					\$dt['percent'] = ceil((\$p)/\$num*100);\n";						
						$str .="					try{\n";
						$str .="						for(\$i=1; \$i<=\$export_per_num; \$i++ ){\n";
						$str .="						//根据中文名称来读取字段名称\n";
						$str .="							if(\$data[\$i + (\$p-1)*\$export_per_num]){\n";
						$str .="								foreach(\$data[1] as \$key=>\$val){\n";
						$str .="									\$fieldInfo = db('field')->where(['name'=>\$val,'menu_id'=>".$menu_id."])->find();\n";
						if($val['fields']){
							$str .="									if(\$val && \$fieldInfo && in_array(\$fieldInfo['field'],explode(',',\$export_fields))){\n";
						}else{
							$str .="									if(\$val && \$fieldInfo){\n";
						}
						$str .="										\$d[\$fieldInfo['field']] = \$data[\$i + (\$p-1)*\$export_per_num][\$key];\n";
						$str .="										if(\$fieldInfo['type'] == 17){\n";
						$str .="											unset(\$d[\$fieldInfo['field']]);\n";
						$str .="										}\n";
						$str .="										if(in_array(\$fieldInfo['type'],[7,12])){	//时间字段\n";
						$str .="											if(strlen(\$data[\$i + (\$p-1)*\$export_per_num][\$key]) == 5){\n";
						$str .="												\$d[\$fieldInfo['field']] = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToTimestamp(\$data[\$i + (\$p-1)*\$export_per_num][\$key]);\n";
						$str .="											}else{\n";
						$str .="												\$d[\$fieldInfo['field']] = strtotime(\$data[\$i + (\$p-1)*\$export_per_num][\$key]);\n";
						$str .="											}\n";
						$str .="										}\n";
						$str .="										if(\$fieldInfo['type'] == 5){	//密码字段\n";
						$str .="											\$d[\$fieldInfo['field']] = md5(\$data[\$i + (\$p-1)*\$export_per_num][\$key].config('my.password_secrect'));\n";
						$str .="										}\n";
						$str .="										if(\$fieldInfo['type'] == 17){	//三级联动字段\n";
						$str .="											\$arrTitle = explode('|',\$fieldInfo['field']);\n";
						$str .="											\$arrValue = explode('-',\$data[\$i + (\$p-1)*\$export_per_num][\$key]);\n";
						$str .="											if(\$arrTitle && \$arrValue){\n";
						$str .="												foreach(\$arrTitle as \$k=>\$v){\n";
						$str .="													\$d[\$v] = \$arrValue[\$k];\n";
						$str .="												}\n";
						$str .="											}\n";
						$str .="										}\n";
						$str .="										if(in_array(\$fieldInfo['type'],[2,3,23,29]) && empty(\$fieldInfo['sql'])){	//下拉，单选，开关按钮\n";
						$str .="											\$d[\$fieldInfo['field']] = getFieldName(\$data[\$i + (\$p-1)*\$export_per_num][\$key],\$fieldInfo['config']);\n";
						$str .="										}\n";
						$str .="									}\n";
						$str .="								}\n";
						$fieldList = Field::where(['menu_id'=>$menu_id])->select();
						foreach($fieldList as $key=>$val){
							if($val['type'] == 12){
								$timeField = $val['field'];
								$str .="								\$d['".$val['field']."'] = time();\n";
							}
							if($val['type'] == 15){
								$str .="								\$d['".$val['field']."'] = session('".$applicationInfo['app_dir'].".".$val['field']."');\n";
							}
						}
						$str .="								if((\$i + (\$p-1)*\$export_per_num) > 1){\n";
						$str .="									".$menuInfo['controller_name']."Model::create(\$d);\n";
						$str .="								}\n";
						$str .="							}\n";
						
						$str .="						}\n";
						$str .="					}catch(\Exception \$e){\n";
						$str .="						abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="					}\n";
						$str .="					return json(['error'=>'00','data'=>\$dt]);\n";
						$str .="				}else{\n";
						$str .="					cache('".getControllerName($menuInfo['controller_name'])."',null);\n";
						$str .="					return json(['error'=>'10']);\n";
						$str .="				}\n";
						$str .="			}else{\n";
						$str .="				\$this->error('当前没有数据');\n";
						$str .="			}\n";
						$str .="		}\n";
						$str .="	}\n";
					}

				break;
				
				//批量修改数据
				case 14:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['block_name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		if (!\$this->request->isPost()){\n";
						$str .="			\$".$pk_id." = \$this->request->get('".$pk_id."','','serach_in');\n";
						$str .="			if(!\$".$pk_id.") \$this->error('参数错误');\n";
						$str .="			\$this->view->assign('info',['".$pk_id."'=>\$".$pk_id."]);\n";
						$str .="			return view('".$val['action_name']."');\n";
						$str .="		}else{\n";
						$str .="			\$postField = '".$menuInfo['pk_id'].",".str_replace('|',',',$val['fields'])."';\n";
						$str .="			\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="			\$where['".$menuInfo['pk_id']."'] = explode(',',\$data['".$pk_id."']);\n";
						$str .="			unset(\$data['".$menuInfo['pk_id']."']);\n";
						$str .="			try {\n";
						$fieldList = Field::where(['menu_id'=>$menu_id])->order('sortid asc')->select();
						$fields = explode(',',$val['fields']);
						if($fields){
							foreach($fields as $k=>$v){
								foreach($fieldList as $m=>$n){
									if($v == $n['field']){
										if(in_array($n['type'],[7,12,25])){
											$str .="				\$data['".$v."'] = strtotime(\$data['".$v."']);\n";
										}
										if($n['type'] == 5){
											if(config('my.password_secrect')){
												$str .= "			\$data['".$v."'] = md5(\$data['".$v."'].config('my.password_secrect'));\n";
											}else{
												$str .= "			\$data['".$v."'] = md5(\$data['".$v."']);\n";
											}
										}
										if($n['type'] == 15){
											$fieldData .= "			\$data['".$v."'] = session('".$applicationInfo['app_dir'].".".$v."');\n";
										}
										if($n['type'] == 27){
											$str .= "				\$data['".$v."'] = implode(',',\$data['".$v."']);\n";
										}
									}
								}
							}
						}
						
						$str .="				db('".$menuInfo['table_name']."')->where(\$where)->update(\$data);\n";
						$str .="			} catch (\Exception \$e) {\n";
						$str .="				abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="			}\n";
						$str .="			return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="		}\n";
						$str .="	}\n\n";
					}
					if($val['is_view_create'] !== 0){
						//生成创建模板界面
						self::createInfoTpl($applicationInfo,$menuInfo,$val,Field::where(['menu_id'=>$menu_id,'is_post'=>1])->order('sortid asc')->select());
					}

				break;
				
				//查看数据
				case 15:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$".$pk_id." = \$this->request->get('".$pk_id."','','serach_in');\n";
						$str .="		if(!$".$menuInfo['pk_id'].") \$this->error('参数错误');\n";
						$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
						if(!empty($val['sql_query'])){
							if(strpos(strtolower($val['sql_query']),'join') > 0){
								$pre_table = 'a.';
							}
							$str .="		\$info = Db::connect('".$connect."')->query('".$val['sql_query']." where ".$pre_table."".$pk_id." = '.$".$pk_id.");\n";
							$str .="		\$this->view->assign('info',current(\$info));\n";
						}else{
							if(!empty($val['relate_table']) && !empty($val['relate_field'])){
								if(!$val['list_field']){
									$field = 'a.*,b.*';
								}else{
									$field = $val['list_field'];
								}
								$str .="		\$sql = 'select ".$field." from ".config('database.connections.'.$connect.'.prefix').$menuInfo['table_name']." as a left join ".config('database.connections.'.$connect.'.prefix').$val['relate_table']." as b on a.".$val['relate_field']." = b.".$val['relate_field']." where a.".$menuInfo['pk_id']." = '.\$".$pk_id.".' limit 1';\n";
								$str .="		\$info = Db::connect('".$connect."')->query(\$sql);\n";
								$str .="		\$this->view->assign('info',current(\$info));\n";
							}else{
								$str .="		\$this->view->assign('info',".getControllerName($menuInfo['controller_name'])."Model::find($".$pk_id."));\n";
							}	
						}
						$str .="		return view('".$val['action_name']."');\n";
						$str .="	}\n\n";
							
					}
					if($val['is_view_create'] !== 0){
						self::createViewTpl($applicationInfo,$menuInfo,$val,Field::where(['menu_id'=>$menu_id])->order('sortid asc')->select());
					} 			
					
				break;
				
				//修改排序、开关按钮操作
				case 16:
					if($val['is_controller_create'] !== 0 && $updateExt_field){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$postField = '".$pk_id.$updateExt_field."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="		if(!\$data['".$pk_id."']) \$this->error('参数错误');\n";
						$str .="		try{\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Model::update(\$data);\n";
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="	}\n\n";
					}
				break;
				
				
				//箭头排序
				case 30:
					if($val['is_controller_create'] !== 0){
						$sortidField =  db("field")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>22])->value('field');
						$listActionInfo = db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>1])->find();
						list($lgt_1,$orderby_1,$lgt_2,$orderby_2) = ['>','asc','<','desc'];
						if($listActionInfo['default_orderby']){
							$default_orderby = strtolower($listActionInfo['default_orderby']);
							if(preg_match('/'.$sortidField.'(.*)asc/',$default_orderby)){
								list($lgt_1,$orderby_1,$lgt_2,$orderby_2) = ['<','desc','>','asc'];
							}
						}
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$postField = '".$pk_id.",sortid,type';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="		if(empty(\$data['sortid'])){\n";
						$str .="			\$this->error('操作失败，当前数据没有排序号');\n";
						$str .="		}\n";
						$treeInfo = db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>1])->value('tree_config');
						if($treeInfo){
							$treePid = explode(',',$treeInfo)[0];
							$str .="		\$pid = ".getControllerName($menuInfo['controller_name'])."Model::where('".$pk_id."',\$data['".$pk_id."'])->value('".$treePid."');\n";
						}
						$str .="		if(\$data['type'] == 1){\n";
						if($treePid){
							$str .="			\$where['".$treePid."'] = \$pid;\n";
						}
						$str .="			\$where['".$sortidField."'] = ['".$lgt_1."',\$data['sortid']];\n";
						$str .="			\$info = ".getControllerName($menuInfo['controller_name'])."Model::where(formatWhere(\$where))->order('".$sortidField." ".$orderby_1."')->find();\n";
						$str .="		}else{\n";
						if($treePid){
							$str .="			\$where['".$treePid."'] = \$pid;\n";
						}
						$str .="			\$where['".$sortidField."'] = ['".$lgt_2."',\$data['sortid']];\n";
						$str .="			\$info = ".getControllerName($menuInfo['controller_name'])."Model::where(formatWhere(\$where))->order('".$sortidField." ".$orderby_2."')->find();\n";
						$str .="		}\n";
						$str .="		if(empty(\$info['".$sortidField."'])){\n";
						$str .="			\$this->error('操作失败，目标位置没有排序号');\n";
						$str .="		}\n";
						$str .="		if(\$info){\n";
						$str .="			try{\n";
						$str .="				".getControllerName($menuInfo['controller_name'])."Model::update(['".$pk_id."'=>\$data['".$pk_id."'],'".$sortidField."'=>\$info['".$sortidField."']]);\n";
						$str .="				".getControllerName($menuInfo['controller_name'])."Model::update(['".$pk_id."'=>\$info['".$pk_id."'],'".$sortidField."'=>\$data['sortid']]);\n";
						$str .="			}catch(\Exception \$e){\n";
						$str .="				throw new \\think\\exception\\ValidateException (\$e->getMessage());\n";
						$str .="			}\n";
						$str .="		}else{\n";
						$str .="			\$this->error('目标位置没有数据');\n";
						$str .="		}\n";
						$str .="		return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="	}\n\n";
					}						
				break;
				
				
				//软删除数据还原
				case 34:
					if($val['is_controller_create'] !== 0){
						$str .="	/*".$val['name']."*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .= "		\$idx =  \$this->request->post('".$pk_id."', '', 'serach_in');\n";
						$str .="		if(!\$idx) \$this->error('参数错误');\n";
						$str .="		try{\n";
						$str .="			\$data = ".getControllerName($menuInfo['controller_name'])."Model::onlyTrashed()->where(['".$pk_id."'=>explode(',',\$idx)])->select();\n";
						$str .="			foreach(\$data as \$v){\n";
						$str .="				\$v->restore();\n";
						$str .="			}\n";
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return json(['status'=>'00','msg'=>'操作成功']);\n";
						$str .="	}\n\n";
					}
					
				break;
				
				default:
					$str .= ExtendService::getAdminExtendFuns($val,$fieldList);
					
					
			}
		}
		
		
		//生成控制器 服务层 数据库文件
		try{
			$rootPath = app()->getRootPath();
			$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/controller/'.$menuInfo['controller_name'].'.php';
			filePutContents($str,$filepath,$type=1);
			
			$this->createAdminService($actionList,$applicationInfo,$menuInfo); //根据应用生成相应的服务层代码
			$this->createModel($actionList,$applicationInfo,$menuInfo); //根据应用生成相应的服务层代码
			$this->createValidate($actionList,$applicationInfo,$menuInfo); //根据应用生成相应的验证器
		}catch(\Exception $e){
			$this->error($e->getMessage());
		}
		return true;
	}
	
	
	/**
     * 生成后台服务层代码
     * @param array applicationInfo 应用信息
	 * @param array actionList 操作列表
	 * @param array menuInfo 菜单信息
     * @throws \Exception
     * @return bool
     */
	public function createAdminService($actionList,$applicationInfo,$menuInfo){
		if($actionList){
			$str = '';
			$str = "<?php \n";
			!is_null(config('my.comment.file_comment')) ? config('my.comment.file_comment') : true;
			if(config('my.comment.file_comment')){
			$str .= "/*\n";
			$str .= " module:		".$menuInfo['title']."\n";
			$str .= " create_time:	".date('Y-m-d H:i:s')."\n";
			$str .= " author:		".config('my.comment.author')."\n";
			$str .= " contact:		".config('my.comment.contact')."\n";
			$str .= "*/\n\n";
			}
			$str .= "namespace app\\".$applicationInfo['app_dir']."\\service".getDbName($menuInfo['controller_name']).";\n";
			if($menuInfo['table_name']){
				$str .= "use app\\".$applicationInfo['app_dir']."\\model\\".getUseName($menuInfo['controller_name']).";\n";
			}
			$str .= "use think\\exception\\ValidateException;\n";
			$str .= "use xhadmin\CommonService;\n";

			if($actionList){
				foreach($actionList as $k=>$v){
					if($v['type'] == 12){
						$excelStatus = true;
					}
				}
			}
			if($excelStatus){
				$str .= "use PhpOffice\PhpSpreadsheet\Spreadsheet;\n";
				$str .= "use PhpOffice\PhpSpreadsheet\Writer\Xlsx;\n";
			}
			$str .="\n";
			$str .= "class ".getControllerName($menuInfo['controller_name'])."Service extends CommonService {\n\n\n";
			$fieldList = htmlOutList(Field::where(['menu_id'=>$menuInfo['menu_id']])->order('sortid asc')->select()->toArray());
			
			foreach($actionList as $key=>$val){
				if($val['is_service_create'] !== 0){
					switch($val['type']){
						
						//数据列表
						case 1:
							if(empty($val['sql_query'])){	
								$str .="	/*\n";
								$str .=" 	* @Description  ".$val['block_name']."列表数据\n";
								$str .=" 	*/\n";
								$str .= "	public static function ".$val['action_name']."List(\$where,\$field,\$order,\$limit,\$page){\n";
								$str .= "		try{\n";
								if(!empty($val['fields']) && !empty($val['relate_field']) && !empty($val['relate_table'])){
									if($menuInfo['connect']){
										$str .= "			\$res = db('".$menuInfo['table_name']."','".$menuInfo['connect']."')->field(\$field)->alias('a')->join('".$val['relate_table']." b','a.".$val['fields']."=b.".$val['relate_field']."','left')->where(\$where)->order(\$order)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
									}else{
										$str .= "			\$res = db('".$menuInfo['table_name']."')->field(\$field)->alias('a')->join('".$val['relate_table']." b','a.".$val['fields']."=b.".$val['relate_field']."','left')->where(\$where)->order(\$order)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
									}
								}else{
									$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->field(\$field)->order(\$order)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
								}
								$str .= "		}catch(\Exception \$e){\n";
								if(config('my.error_log_code')){
									$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
								}else{
									$str .= "			abort(500,\$e->getMessage());\n";
								}
								$str .= "		}\n";
								$str .= "		return ['rows'=>\$res['data'],'total'=>\$res['total']];\n";
								$str .= "	}\n\n\n";	
							}
							
						break;
						
						//软删除数据列表
						case 32:
							if(empty($val['sql_query'])){	
								$str .="	/*\n";
								$str .=" 	* @Description  ".$val['block_name']."软删除列表数据\n";
								$str .=" 	*/\n";
								$str .= "	public static function ".$val['action_name']."List(\$where,\$field,\$order,\$limit,\$page){\n";
								$str .= "		try{\n";
								if(!empty($val['fields']) && !empty($val['relate_field']) && !empty($val['relate_table'])){
									$str .= "			\$res = db('".$menuInfo['table_name']."')->field(\$field)->alias('a')->join('".$val['relate_table']." b','a.".$val['fields']."=b.".$val['relate_field']."','left')->where(\$where)->order(\$order)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
								}else{
									$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::onlyTrashed()->where(\$where)->field(\$field)->order(\$order)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
								}
								$str .= "		}catch(\Exception \$e){\n";
								if(config('my.error_log_code')){
									$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
								}else{
									$str .= "			abort(500,\$e->getMessage());\n";
								}
								$str .= "		}\n";
								$str .= "		return ['rows'=>\$res['data'],'total'=>\$res['total']];\n";
								$str .= "	}\n\n\n";	
							}
							
						break;
						
						//添加数据
						case 3:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							if($val['relate_table']){
									$str .="			db()->startTrans();\n\n";
								}
							foreach($fieldList as $k=>$v){
								if(in_array($v['field'],explode(',',$val['fields']))){
									//日期框
									if($v['type'] == 7){
										$fieldData .= "			\$data['".$v['field']."'] = strtotime(\$data['".$v['field']."']);\n";
									}
									//密码框
									if($v['type'] == 5){
										if(config('my.password_secrect')){
											$str .= "			\$data['".$v['field']."'] = md5(\$data['".$v['field']."'].config('my.password_secrect'));\n";
										}else{
											$str .= "			\$data['".$v['field']."'] = md5(\$data['".$v['field']."']);\n";
										}
									}
									//后台创建时间
									if($v['type'] == 12){
										$fieldData .= "			\$data['".$v['field']."'] = time();\n";
									}
									
									//session
									if($v['type'] == 15){
										$fieldData .= "			\$data['".$v['field']."'] = session('".$applicationInfo['app_dir'].".".$v['field']."');\n";
									}
									//随机数
									if($v['type'] == 21){
										$fieldData .= "			\$data['".$v['field']."'] = random(".$v['default_value'].",'all');\n";
									}
									
									//IP
									if($v['type'] == 26){
										$fieldData .= "			\$data['".$v['field']."'] = request()->ip();\n";
									}
									
									//下拉多选
									if($v['type'] == 27){
										$fieldData .= "			\$data['".$v['field']."'] = implode(',',\$data['".$v['field']."']);\n";
									}
									
									//订单号
									if($v['type'] == 30){
										$default_value = !empty($v['default_value']) ? $v['default_value'] : '000';
										$fieldData .= "			\$data['".$v['field']."'] = doOrderSn('".$default_value."');\n";
									}
								}
							}
							
							$str .= $fieldData;
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::create(\$data);\n";
							if($val['relate_table']){
									$str .="			\$data['".$menuInfo['pk_id']."'] = \$res->".$menuInfo['pk_id'].";\n";
									$str .="			db('".$val['relate_table']."')->insert(\$data);\n\n";
									$str .="			db()->commit();\n";
							}
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if($val['relate_table']){
									$str .="			db()->rollback();\n";
							}
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		if(!\$res){\n";
							$str .= "			throw new ValidateException ('操作失败');\n";
							$str .= "		}\n";
							
							$str .= "		return \$res->".$menuInfo['pk_id'].";\n";
							$str .= "	}\n\n\n";
							$rule = '';
							$msg = '';
							$fieldData = '';
						break;
						
						
						//修改数据
						case 4:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							if($val['relate_table']){
								$str .="			db()->startTrans();\n\n";
							}
							
							foreach($fieldList as $k=>$v){
								if(in_array($v['field'],explode(',',$val['fields']))){
									//判断是否有日期框的
									if(in_array($v['type'],[7,12])){
										$fieldData .= "			\$data['".$v['field']."'] = strtotime(\$data['".$v['field']."']);\n";
									}
									//session字段
									if($v['type'] == 15){
										$fieldData .= "			\$data['".$v['field']."'] = session('".$applicationInfo['app_dir'].".".$v['field']."');\n";
									}
									//更新时间
									if($v['type'] == 25){
										$fieldData .= "			\$data['".$v['field']."'] = time();\n";
									}
									//下拉多选
									if($v['type'] == 27){
										$fieldData .= "			\$data['".$v['field']."'] = implode(',',\$data['".$v['field']."']);\n";
									}
								}
							}
							
							$str .= $fieldData;
							
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::update(\$data);\n";
							if($val['relate_table']){
									$str .="			db('".$val['relate_table']."')->where('".$menuInfo['pk_id']."',\$data['".$menuInfo['pk_id']."'])->update(\$data);\n\n";
									$str .="			db()->commit();\n";
							}
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if($val['relate_table']){
									$str .="			db()->rollback();\n";
							}
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		if(!\$res){\n";
							$str .= "			throw new ValidateException ('操作失败');\n";
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
							$rule = '';
							$msg = '';
							$field ='';
							$validate ='';
							$fieldData = '';
						break;
						
						//充值
						case 7:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$where,\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->inc('".$val['fields']."',\$data['".$val['fields']."'])->update();\n";
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
						break;
						
						//回收
						case 8:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$where,\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							$str .="			\$info = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->find();\n";
							$str .="			if(\$info->".$val['fields']." < \$data['".$val['fields']."']) throw new ValidateException('操作数据不足');\n";
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->dec('".$val['fields']."',\$data['".$val['fields']."'])->update();\n";
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
						break;
						
						//重置密码
						case 9:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							if(config('my.password_secrect')){
								$str .="			\$data['".$val['fields']."'] = md5(\$data['".$val['fields']."'].config('my.password_secrect'));\n";
							}else{
								$str .="			\$data['".$val['fields']."'] = md5(\$data['".$val['fields']."']);\n";
							}
							$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."::update(\$data);\n";
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
						break;
						
						
						//导出数据
						case 12:
							if(empty($val['relate_table']) && empty($val['relate_field']) && empty($val['sql_query'])){
								$str .="	/*\n";
								$str .=" 	* @Description  ".$val['block_name']."\n";
								$str .=" 	*/\n";
								$str .="	public static function ".$val['action_name']."(\$list,\$field){\n";
								$str .=	"		ob_clean();\n";
								$str .= "		try{\n";
								$str .= "			\$map['menu_id'] = ".$menuInfo['menu_id'].";\n";
								$str .= "			\$map['field'] = \$field;\n";
								$str .= "			\$fieldList = db(\"field\")->where(\$map)->order('sortid asc')->select()->toArray();\n\n";
								
								$str .= "			\$spreadsheet = new Spreadsheet();\n";
								$str .= "			\$sheet = \$spreadsheet->getActiveSheet();\n";
								$str .= "			//excel表头\n";
								$str .= "			foreach(\$fieldList as \$key=>\$val){\n";
								$str .= "				\$sheet->setCellValue(getTag(\$key+1).'1',\$val['name']);\n";
								$str .= "			}\n";
								$str .= "			//excel表主体内容\n";
								$str .= "			foreach(\$list as \$k=>\$v){\n";
								$str .= "				foreach(\$fieldList as \$m=>\$n){\n";
								$str .= "					if(in_array(\$n['type'],[7,12,25]) && \$v[\$n['field']]){\n";
								$str .= "						\$v[\$n['field']] = !empty(\$v[\$n['field']]) ? date(getTimeFormat(\$n),\$v[\$n['field']]) : '';\n";
								$str .= "					}\n";
								$str .= "					if(in_array(\$n['type'],[2,3,4,23,27,29]) && !empty(\$n['config'])){\n";
								$str .= "						\$v[\$n['field']] = getFieldVal(\$v[\$n['field']],\$n['config']);\n";
								$str .= "					}\n";
								$str .= "					if(\$n['type'] == 17){\n";
								$str .= "						foreach(explode('|',\$n['field']) as \$q){\n";
								$str .= "							\$v[\$n['field']] .= \$v[\$q].'-';\n";
								$str .= "						}\n";
								$str .= "						\$v[\$n['field']] = rtrim(\$v[\$n['field']],'-');\n";
								$str .= "					}\n";
								$str .= "					\$sheet->setCellValueExplicit(getTag(\$m+1).(\$k+2),\$v[\$n['field']],\PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
";
								$str .= "					\$v[\$n['field']] = '';\n";
								$str .= "				}\n";
								$str .= "			}\n";
							}else{
								$str .="	/*\n";
								$str .=" 	* @Description  ".$val['block_name']."\n";
								$str .=" 	* @param (输入参数：)  {array}        where 删除条件\n";
								$str .=" 	* @return (返回参数：) {bool}        \n";
								$str .=" 	*/\n";
								$str .= "	public static function ".$val['action_name']."(\$list){\n";
								$str .=	"		ob_clean();\n";
								$str .= "		try{\n";
								$str .= "			\$spreadsheet = new Spreadsheet();\n";
								$str .= "			\$sheet = \$spreadsheet->getActiveSheet();\n";
								$str .= "			//excel表头\n";
								
								$i=0;
								foreach($fieldList as $key=>$val){
									if($val['list_show'] == 1){
										$i++;
										$str .="			\$sheet->setCellValue('".getTag($i)."1','".$val['name']."');\n";
									}
								}
								$str .= "\n";
								$str .= "			//excel表内容\n";
								$str .= "			foreach(\$list as \$k=>\$v){\n";
								$j=0;
								foreach($fieldList as $key=>$val){
									if($val['list_show'] == 1){
										$j++;
										if(in_array($val['type'],[7,12,25])){
											$str .= "				\$v['".$val['field']."'] = !empty(\$v['".$val['field']."']) ? date('Y-m-d H:i:s',\$v['".$val['field']."']) : '';\n";
										}
										if(in_array($val['type'],[2,3,4,23,27,29]) && !empty($val['config'])){
											$str .= "				\$v['".$val['field']."'] = getFieldVal(\$v['".$val['field']."'],'".$val['config']."');\n";
										}
										if($val['type'] == 17){
											foreach(explode('|',$val['field']) as $k=>$v){
												$d .= "\$v['".$v."'].'-'.";
											}
											$d = rtrim($d,".'-'.");
											$str .= "				\$v['".$val['field']."'] = ".$d.";\n";
										}
										$str .="				\$sheet->setCellValue('".getTag($j)."'.(\$k+2),\$v['".$val['field']."']);\n";
									}
									$d = '';
								}
								$str .= "			}\n";
							}
							$str .= "			\n";
							$str .= "			\$filename = date('YmdHis');\n";
							$str .= "			header('Content-Type: application/vnd.ms-excel');\n";
							$str .= "			header('Content-Disposition: attachment;filename='.\$filename.'.'.config('my.import_type')); \n";
							$str .= "			header('Cache-Control: max-age=0');\n";
							$str .= "			\$writer = new Xlsx(\$spreadsheet); \n";
							$str .= "			\$writer->save('php://output');\n";
							$str .= "			exit;\n";
							$str .= "		}catch(\Exception \$e){\n";
							$str .= "			throw new \Exception(\$e->getMessage());\n";
							$str .= "		}\n";
							$str .= "	}\n";
							
						break;
							
					}
				}
			}
			$rootPath = app()->getRootPath();
			$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/service/'.$menuInfo['controller_name'].'Service.php';
			filePutContents($str,$filepath,$type=1);
		}	
	}
	
	
	
	/**
     * 生成api模块
     * @param string $menu_id
     * @throws \Exception
     * @return bool
     */
	public function createApiModule($menuInfo,$applicationInfo,$actionList){
		$menu_id = $menuInfo['menu_id'];
		$pk_id = $menuInfo['pk_id'];
		$str = '';
		$str = "<?php \n";
		!is_null(config('my.comment.file_comment')) ? config('my.comment.file_comment') : true;
		if(config('my.comment.file_comment')){
		$str .= "/*\n";
		$str .= " module:		".$menuInfo['title']."\n";
		$str .= " create_time:	".date('Y-m-d H:i:s')."\n";
		$str .= " author:		".config('my.comment.author')."\n";
		$str .= " contact:		".config('my.comment.contact')."\n";
		$str .= "*/\n\n";
		}
		$str .= "namespace app\\".$applicationInfo['app_dir']."\controller".getDbName($menuInfo['controller_name']).";\n\n";
		$str .= "use app\\".$applicationInfo['app_dir']."\\service\\".getUseName($menuInfo['controller_name'])."Service;\n";
		if($menuInfo['table_name']){
			$str .= "use app\\".$applicationInfo['app_dir']."\\model\\".getUseName($menuInfo['controller_name'])." as ".getControllerName($menuInfo['controller_name'])."Model;\n";
		}
		if(strpos($menuInfo['controller_name'],'/') > 0){
			$str .= "use app\\".$applicationInfo['app_dir']."\\controller\Common;\n";
		}
		$str .="use think\\exception\\ValidateException;\n";
		$str .="use think\\facade\\Db;\n";
		$str .="use think\\facade\\Log;\n";
		$str .="\n";
		$str .= "class ".getControllerName($menuInfo['controller_name'])." extends Common {\n\n\n";
		$note_status = !is_null(config('my.comment.api_comment')) ? config('my.comment.api_comment') : true;  //注释生成状态
		$fieldList = Field::where(['menu_id'=>$menu_id])->order('sortid asc')->select()->toArray();
		foreach($fieldList as $k=>$v){
			$postFields[] = $v['field'];
		}
		
		foreach($actionList as $key=>$val){
			foreach($fieldList as $k=>$v){
				if($v['type'] == 24 && $val['api_auth']){
					$token_str .="		\$data['".$v['field']."'] = \$this->request->uid;	//token解码用户ID\n";
					$token_field = $v['field'];
				}
			}
			
			switch($val['type']){
				//数据列表
				case 1:
					if($val['is_controller_create'] !== 0){
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'get';
						$str .="	/**\n";
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
							$str .= "\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
							$str .= "\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						
						$str .="	* @apiParam (输入参数：) {int}     		[limit] 每页数据条数（默认20）\n";
						$str .="	* @apiParam (输入参数：) {int}     		[page] 当前页码\n";
						foreach($fieldList as $k=>$v){
							if(($v['search_show'] == 1 && in_array($v['type'],[1,2,3,4,6,7,12,13,17,21,23,27,28,29,30])) && $v['type'] <> 24){
								if(in_array($v['type'],[2,3,4,20,22,23])){
									$fieldType = '{int}			';
								}else{
									$fieldType = '{string}		';
								}
								if($v['type'] == 7){	
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."_start] ".$v['name']."开始\n";
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."_end] ".$v['name']."结束\n";
								}elseif($v['type'] == 12){	
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."_start] ".$v['name']."开始\n";
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."_end] ".$v['name']."结束\n";
								}elseif($v['type'] == 13){	
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."_start] ".$v['name']."开始\n";
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."_end] ".$v['name']."结束\n";
								}elseif($v['type'] == 17){
									foreach(explode('|',$v['field']) as $m=>$n){
										switch($m){
											case 0;
												$disname = '省';
											break;
											case 1;
												$disname = '市';
											break;
											case 2;
												$disname = '区';
											break;
										}
										$str .="	* @apiParam (输入参数：) ".$fieldType."[".$n."] ".$disname."\n";
									}
								}else{
									$str .="	* @apiParam (输入参数：) ".$fieldType."[".$v['field']."] ".$v['name']." ".$v['config']."\n";
								}
							}
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.data 返回数据\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.data.list 返回数据列表\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.data.count 返回数据总数\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"data\":\"\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\" ".config('my.errorCode')."\",\"msg\":\"查询失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$pagesize = !empty($val['pagesize']) ? $val['pagesize'] : 20;
						if($request_type == 'post'){
							$str .="		if(!\$this->request->isPost()){\n";
							$str .="			throw new ValidateException('请求错误');\n";
							$str .="		}\n";
						}
						$str .="		\$limit  = \$this->request->".$request_type."('limit', ".$pagesize.", 'intval');\n";
						$str .="		\$page   = \$this->request->".$request_type."('page', 1, 'intval');\n\n";
						$str .="		\$where = [];\n";
						if($fieldList){
							foreach($fieldList as $k=>$v){
								if(($v['search_show'] == 1 && in_array($v['type'],[1,2,3,4,6,7,12,13,17,20,21,23,24,28,29,30])) || $v['type'] == 14){
									$pre = '';
									
									if($v['type'] ==  4){
										$str .="\n"; 
										$str .="		\$where['".$pre."".$v['field']."'] = ['find in set',\$this->request->param('".$v['field']."', '', 'serach_in')];\n";
									}elseif($v['type'] ==  7){
										$str .="\n"; 
										$str .="		\$".$v['field']."_start = \$this->request->".$request_type."('".$v['field']."_start', '', 'serach_in');\n";
										$str .="		\$".$v['field']."_end = \$this->request->".$request_type."('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="		\$where['".$pre."".$v['field']."'] = ['between',[strtotime(\$".$v['field']."_start),strtotime(\$".$v['field']."_end)]];\n";
									}elseif($v['type'] ==  12){
										$str .="\n"; 
										$str .="		\$".$v['field']."_start = \$this->request->".$request_type."('".$v['field']."_start', '', 'serach_in');\n";
										$str .="		\$".$v['field']."_end = \$this->request->".$request_type."('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="		\$where['".$pre."".$v['field']."'] = ['between',[strtotime(\$".$v['field']."_start),strtotime(\$".$v['field']."_end)]];\n";
									}elseif($v['type'] ==  13){
										$str .="\n"; 
										$str .="		\$".$v['field']."_start = \$this->request->".$request_type."('".$v['field']."_start', '', 'serach_in');\n";
										$str .="		\$".$v['field']."_end = \$this->request->".$request_type."('".$v['field']."_end', '', 'serach_in');\n\n";
										$str .="		\$where['".$pre."".$v['field']."'] = ['between',[\$".$v['field']."_start,\$".$v['field']."_end]];\n";
									}elseif($v['type'] == 15){
										$str .="		\$where['".$pre."".$v['field']."'] = session('".$applicationInfo['app_dir'].'.'.$v['field']."');\n";
									}elseif($v['type'] == 17){
										foreach(explode('|',$v['field']) as $m=>$n){
											$str .="		\$where['".$pre."".$n."'] = \$this->request->".$request_type."('".$n."', '', 'serach_in');\n";
										}
									}elseif($v['type'] == 24){
										$str .="		\$where['".$pre."".$v['field']."'] = \$this->request->uid;	//token解码用户ID\n";
									}else{
										if($v['search_type']){
											$str .="		\$where['".$pre."".$v['field']."'] = ['like',\$this->request->".$request_type."('".$v['field']."', '', 'serach_in')];\n";
										}else{
											$str .="		\$where['".$pre."".$v['field']."'] = \$this->request->".$request_type."('".$v['field']."', '', 'serach_in');\n";
										}
										
									}
								}							
							}
						}
						if(($val['relate_table'] && $val['relate_field']) || strpos(strtolower($val['sql_query']),'join') > 0){
							$pre = 'a.';
							$softDeleteAction =  db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>31])->value('action_name');
							if($softDeleteAction){
								if($val['type'] == 1){
									$str .="		\$where['".$pre."delete_time'] = ['exp','is null'];\n";
								}
								if($val['type'] == 32){
									$str .="		\$where['".$pre."delete_time'] = ['exp','is not null'];\n";
								}
							}
						}
						$str .= "\n";
						if(!empty($val['relate_table']) && !empty($val['relate_field'])){
							if(!empty($val['list_field'])){
								$str .="		\$field = '".$val['list_field']."';\n";
							}else{
								$str .="		\$field = 'a.*,b.*';\n";
							}
						}else{
							if(!empty($val['fields'])){
								$str .="		\$field = '".str_replace('|',',',$val['fields'])."';\n";
							}else{
								$str .="		\$field = '*';\n";
							}
						}
						
						if(!empty($val['default_orderby'])){
							$str .="		\$orderby = '".$val['default_orderby']."';\n\n";
						}else{
							$str .="		\$orderby = '".$pk_id." desc';\n\n";
						}
						
						if($val['cache_time']){
							$str .="		\$key = md5(implode(',',\$where).\$limit.\$field.\$orderby);\n";
							$str .="		if(cache(\$key)){\n";
							$str .="			\$res = cache(\$key);\n";
							$str .="		}else{\n";
						}
						$s = empty($val['cache_time']) ? '		' : '			';
						//首先判断是否存在数据源
						if(!empty($val['sql_query'])){
							if(false == strpos($val['sql_query'],'.')){
								$val['sql_query'] = str_replace('\'','"',$val['sql_query']);
							}
							$str .=$s."\$sql = '".str_replace(array("\r\n", "\r", "\n"), " ",$val['sql_query'])."';\n";
							$str .="		\$limit = (\$page-1) * \$limit.','.\$limit;\n";
							if($menuInfo['connect']){
								$str .="		\$res = \xhadmin\CommonService::loadList(\$sql,formatWhere(\$where),\$limit,\$orderby,'".$menuInfo['connect']."');\n";
							}else{
								$str .="		\$res = \xhadmin\CommonService::loadList(\$sql,formatWhere(\$where),\$limit,\$orderby);\n";
							}
							
						}else{
							$str .=$s."\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."List(formatWhere(\$where),\$field,\$orderby,\$limit,\$page);\n";
							
						}
						if($val['cache_time']){
							$str .="			cache(\$key,\$res,".$val['cache_time'].");\n";
							$str .="		}\n";
						}
					
						if(!empty($val['tree_config'])){
							$tree_config = explode(',',$val['tree_config']);
							$str .="		\$res['list'] = formartList(['".$pk_id."', '".$tree_config[0]."', '".$tree_config[1]."','".$tree_config[1]."'],\$res['list']);\n";
						}
						$str .="		return \$this->ajaxReturn(\$this->successCode,'返回成功',htmlOutList(\$res));\n";
						$str .="	}\n\n";
						$token_str = '';
					}
				break;
				
				//添加数据
				case 3:
					if($val['is_controller_create'] !== 0){
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	/**\n";
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						foreach(explode(',',$val['fields']) as $k=>$v){
							$fieldInfo = Field::where(['field'=>$v,'menu_id'=>$menuInfo['menu_id']])->find();
							if(!in_array($fieldInfo['type'],[12,24])){
								if(in_array($fieldInfo['type'],[2,3,4,20,22,23])){
									$fieldType = '{int}			';
								}else{
									$fieldType = '{string}		';
								}
								if($fieldInfo['type'] == 17){
									foreach(explode('|',$fieldInfo['field']) as $m=>$n){
										switch($m){
											case 0;
												$disname = '省';
											break;
											case 1;
												$disname = '市';
											break;
											case 2;
												$disname = '区';
											break;
										}
										$str .="	* @apiParam (输入参数：) ".$fieldType."	".$n." ".$disname."\n";
									}	
								}else{
									!empty($fieldInfo['validate']) && $fieldInfo['name'] = $fieldInfo['name'].' (必填)';
									$str .="	* @apiParam (输入参数：) ".$fieldType."	".$v." ".$fieldInfo['name']." ".$fieldInfo['config']."\n";
								}		
							}
						}
						
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码  ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"data\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\" ".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .="	function ".$val['action_name']."(){\n";
						$fields = explode(',',$val['fields']);
						foreach($fields as $k=>$v){
							if(in_array($v,$postFields)){
								$showFields .= ','.$v;
							}
						}
						$showFields = ltrim($showFields,',');
						$str .="		\$postField = '".str_replace('|',',',$showFields)."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'".$request_type."',null);\n";
						$str .=$token_str;
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$data);\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功',\$res);\n";
						$str .="	}\n\n";
						$token_str = '';
						$fields = '';
						$showFields = '';
					}					
				break;
				
				//修改数据
				case 4:
					if($val['is_controller_create'] !== 0){
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	/**\n";
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$fieldInfo = Field::where(['field'=>$pk_id,'menu_id'=>$menuInfo['menu_id']])->find();
						if($fieldInfo['type'] <> 24 || !$val['api_auth']){
							$str .="	\n";
							$str .="	* @apiParam (输入参数：) {string}     		".$pk_id." 主键ID (必填)\n";
						}
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						foreach(explode(',',$val['fields']) as $k=>$v){
							$fieldInfo = Field::where(['field'=>$v,'menu_id'=>$menuInfo['menu_id']])->find();
							if(in_array($fieldInfo['type'],[2,3,4,20,22,23])){
								$fieldType = '{int}			';
							}else{
								$fieldType = '{string}		';
							}
							if($fieldInfo['type'] == 17){
								foreach(explode('|',$fieldInfo['field']) as $m=>$n){
									switch($m){
										case 0;
											$disname = '省';
										break;
										case 1;
											$disname = '市';
										break;
										case 2;
											$disname = '区';
										break;
									}
									$str .="	* @apiParam (输入参数：) ".$fieldType."	".$n." ".$disname."\n";
								}	
							}else{
								!empty($fieldInfo['validate']) && $fieldInfo['name'] = $fieldInfo['name'].' (必填)';
								$str .="	* @apiParam (输入参数：) ".$fieldType."	".$v." ".$fieldInfo['name']." ".$fieldInfo['config']."\n";
							}		
						}
						
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码  ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\" ".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .="	function ".$val['action_name']."(){\n";
						$fields = explode(',',$val['fields']);
						foreach($fields as $k=>$v){
							if(in_array($v,$postFields)){
								$showFields .= ','.$v;
							}
						}
						$showFields = ltrim($showFields,',');
						$str .="		\$postField = '".$menuInfo['pk_id'].",".str_replace('|',',',$showFields)."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'".$request_type."',null);\n";
						$str .=$token_str;
						$str .="		if(empty(\$data['".$pk_id."'])){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";
						$str .="		\$where['".$pk_id."'] = \$data['".$pk_id."'];\n";
						if($token_str && $token_field <> $pk_id){
							$str .="		\$where['".$token_field."'] = \$data['".$token_field."'];\n";
						}
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$where,\$data);\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
						$fields = '';
						$showFields = '';
					}
				break;
				
				//删除
				case 5:
					if($val['is_controller_create'] !== 0){
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	/**\n";
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
											
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="	* @apiParam (输入参数：) {string}     		".$pk_id."s 主键id 注意后面跟了s 多数据删除\n";
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .="	function ".$val['action_name']."(){\n";
						$str .="		\$idx =  \$this->request->post('".$pk_id."s', '', 'serach_in');\n";
						$str .="		if(empty(\$idx)){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";
						
						if($token_str && $token_field <> $pk_id){
						$str .="".$token_str;
						}
						$str .="		\$data['".$pk_id."'] = explode(',',\$idx);\n";
						$str .="		try{\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Model::destroy(\$data,true);\n";
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
					}
					
				break;
				
				//软删除
				case 31:
					if($val['is_controller_create'] !== 0){
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	/**\n";
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
											
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="	* @apiParam (输入参数：) {string}     		".$pk_id."s 主键id 注意后面跟了s 多数据删除\n";
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .="	function ".$val['action_name']."(){\n";
						$str .="		\$idx =  \$this->request->post('".$pk_id."s', '', 'serach_in');\n";
						$str .="		if(empty(\$idx)){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";
						
						if($token_str && $token_field <> $pk_id){
						$str .="".$token_str;
						}
						$str .="		\$data['".$pk_id."'] = explode(',',\$idx);\n";
						$str .="		try{\n";
						$str .="			".getControllerName($menuInfo['controller_name'])."Model::destroy(\$data);\n";
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
					}
					
				break;
				
				//修改状态
				case 6:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$fieldInfo = Field::where(['field'=>$pk_id,'menu_id'=>$menuInfo['menu_id']])->find();
						if($fieldInfo['type'] <> 24 || !$val['api_auth']){
							$str .="	\n";
							$str .="	* @apiParam (输入参数：) {string}     		".$pk_id." 主键ID\n";
						}
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$data['".$pk_id."'] = \$this->request->".$request_type."('".$pk_id."','','intval');\n";
						$str .=$token_str;
						$str .="		if(empty(\$data['".$pk_id."'])){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";						
						if($token_str && $token_field <> $pk_id){
							$str .="		\$where['".$token_field."'] = \$data['".$token_field."'];\n";
						}
						$str .="		\$where['".$pk_id."'] = \$data['".$pk_id."'];\n";
						$str .="		try{\n";
						$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."Model::where(\$where)->update(['".$val['fields']."'=>'".$val['remark']."']);\n";
						$str .="		}catch(\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
					}
					
				break;
				
				//数值加
				case 7:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$fieldInfo = Field::where(['field'=>$pk_id,'menu_id'=>$menuInfo['menu_id']])->find();
						if($fieldInfo['type'] <> 24 || !$val['api_auth']){
							$str .="	\n";
							$str .="	* @apiParam (输入参数：) {string}     		".$pk_id." 主键ID\n";
						}
						$str .="	* @apiParam (输入参数：) {float}     		".$val['fields']." 充值积分\n";
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.data 返回自增ID\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$postField = '".$pk_id.",".$val['fields']."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'".$request_type."',null);\n";
						$str .=$token_str;
						$str .="		if(empty(\$data['".$pk_id."'])){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";
						if($token_str && $token_field <> $pk_id){
							$str .="		\$where['".$token_field."'] = \$data['".$token_field."'];\n";
						}
						$str .="		\$where['".$pk_id."'] = (int) \$data['".$pk_id."'];\n";
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$where,\$data);\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
					}
				break;
				
				//数值减
				case 8:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$fieldInfo = Field::where(['field'=>$pk_id,'menu_id'=>$menuInfo['menu_id']])->find();
						if($fieldInfo['type'] <> 24 || !$val['api_auth']){
							$str .="	\n";
							$str .="	* @apiParam (输入参数：) {string}     		".$pk_id." 主键ID\n";
						}
						$str .="	* @apiParam (输入参数：) {float}     		".$val['fields']." 回收积分\n";
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$postField = '".$pk_id.",".$val['fields']."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'".$request_type."',null);\n";
						$str .=$token_str;
						$str .="		if(empty(\$data['".$pk_id."'])){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";		
						if($token_str && $token_field <> $pk_id){
							$str .="		\$where['".$token_field."'] = \$data['".$token_field."'];\n";
						}
						$str .="		\$where['".$pk_id."'] = (int) \$data['".$pk_id."'];\n";
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$where,\$data);\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
					}					
				break;
				
				//重置密码
				case 9:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$fieldInfo = Field::where(['field'=>$pk_id,'menu_id'=>$menuInfo['menu_id']])->find();
						if($fieldInfo['type'] <> 24 || !$val['api_auth']){
							$str .="	\n";
							$str .="	* @apiParam (输入参数：) {string}     		".$pk_id." 主键ID\n";
						}
						$str .="	* @apiParam (输入参数：) {string}     		".$val['fields']." 新密码(必填)\n";
						$str .="	* @apiParam (输入参数：) {string}     		re".$val['fields']." 重复密码(必填)\n";
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$postField = '".$pk_id.",".$val['fields'].",re".$val['fields']."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'".$request_type."',null);\n";
						$str .=$token_str;
						$str .="		if(empty(\$data['".$pk_id."'])){\n";
						$str .="			throw new ValidateException('参数错误');\n";
						$str .="		}\n";
						$str .="		if(empty(\$data['".$val['fields']."'])){ \n";
						$str .="			throw new ValidateException('密码不能为空');\n";
						$str .="		}\n";
						$str .="		if(\$data['".$val['fields']."'] <> \$data['re".$val['fields']."']){ \n";
						$str .="			throw new ValidateException('两次密码输入不一致');\n";
						$str .="		}\n";
						$str .="		\$where['".$pk_id."'] = \$data['".$pk_id."'];\n";
						if($token_str && $token_field <> $pk_id){
							$str .="		\$where['".$token_field."'] = \$data['".$token_field."'];\n";
						}
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$where,\$data);\n";
						$str .="		return \$this->ajaxReturn(\$this->successCode,'操作成功');\n";
						$str .="	}\n\n";
						$token_str = '';
					}					
				break;
				
				
				//查看数据
				case 15:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'get';
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$fieldInfo = Field::where(['field'=>$pk_id,'menu_id'=>$menuInfo['menu_id']])->find();
						if($fieldInfo['type'] <> 24 || !$val['api_auth']){
							$str .="	\n";
							$str .="	* @apiParam (输入参数：) {string}     		".$pk_id." 主键ID\n";
						}
						if($val['remark']){
							foreach(explode('|',$val['remark']) as $k=>$n){
								$str .="	* @apiParam (输入参数：) {string}     		".$n." 主键ID\n";
							}
						}
						if($val['api_auth']){
							$str .= "\n";
							$str .="	* @apiHeader {String} Authorization 用户授权token\n";
							$str .="	* @apiHeaderExample {json} Header-示例:\n";
							$str .="	* \"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"\n";	
						}
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.data 返回数据详情\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"data\":\"\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"没有数据\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .=$token_str;
						
						if($val['remark']){
							foreach(explode('|',$val['remark']) as $k=>$n){
								$str .="		\$data['".$n."'] = \$this->request->".$request_type."('".$n."','','serach_in');\n";
							}
						}else{
							if(!(BuildService::getFieldType($pk_id,$menu_id) == 24 && $val['api_auth'])){
							$str .="		\$data['".$pk_id."'] = \$this->request->".$request_type."('".$pk_id."','','serach_in');\n";
							}
						}

						if($val['cache_time']){
							$str .="		\$key = md5('".getControllerName($menuInfo['controller_name']).":".$pk_id.":'.\$data['".$pk_id."']);\n";
							$str .="		if(cache(\$key)){\n";
							$str .="			\$res = cache(\$key);\n";
							$str .="		}else{\n";
						}
						$s = empty($val['cache_time']) ? '		' : '			';
						if(!empty($val['sql_query'])){
							if(strpos($val['sql_query'],'join') > 0){
								$pre_table = 'a.';
							}
							$str .=$s."\$res = checkData(Db::query('".$val['sql_query']." where ".$pre_table.$pk_id." = '.\$data['".$pk_id."']));\n";
						}else{
							if(!empty($val['relate_table']) && !empty($val['relate_field'])){
								if(!$val['list_field']){
									$field = 'a.*,b.*';
								}else{
									$field = $val['list_field'];
								}
								$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
								$str .=$s."\$sql = 'select ".$field." from ".config('database.connections.'.$connect.'.prefix').$menuInfo['table_name']." as a left join ".config('database.connections.'.$connect.'.prefix').$val['relate_table']." as b on a.".$val['relate_field']." = b.".$val['relate_field']." where a.".$menuInfo['pk_id']." = '.\$data['".$pk_id."'].' limit 1';\n";
								$str .=$s."\$res = checkData(current(Db::connect('".$connect."')->query(\$sql)));\n";
							}else{
								if(empty($val['fields'])){
									$str .=$s."\$res  = checkData(".getControllerName($menuInfo['controller_name'])."Model::find(\$data['".$pk_id."']));\n";
								}else{
									$fields = explode(',',$val['fields']);
									foreach($fields as $k=>$v){
										if(in_array($v,$postFields)){
											$showFields .= ','.$v;
										}
									}
									$showFields = ltrim($showFields,',');
									$str .=$s."\$field='".$pk_id.",".str_replace('|',',',$showFields)."';\n";
									$str .=$s."\$res  = checkData(".getControllerName($menuInfo['controller_name'])."Model::field(\$field)->where(\$data)->find());\n";
								}
							}	
						}
						if($val['cache_time']){
							$str .="			cache(\$key,\$res,".$val['cache_time'].");\n";
							$str .="		}\n";
						}
						$str .="		return \$this->ajaxReturn(\$this->successCode,'返回成功',\$res);\n";
						$str .="	}\n\n";
						$token_str = '';
						$fields = '';
						$showFields = '';
					}			
					
				break;
				
				//账号密码登录
				case 17:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$str .="	* @api {post} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$str .="	\n";
						if(!empty($val['remark'])){
							list($username,$password,$uid) = explode('|',$val['remark']);
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="	* @apiParam (输入参数：) {string}     		".$username." 登录用户名\n";
						$str .="	* @apiParam (输入参数：) {string}     		".$password." 登录密码\n";
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						if(!empty($val['remark'])){
							list($username,$password,$uid) = explode('|',$val['remark']);
						}
						$str .="		\$postField = '".$username.",".$password."';\n";
						$str .="		\$data = \$this->request->only(explode(',',\$postField),'post',null);\n";
						$str .="		if(empty(\$data['".$username."']) || empty(\$data['".$password."'])) throw new ValidateException('账号或密码不能为空');\n";
						if(empty($val['fields'])){
							$str .="		\$returnField = '*';\n";
						}else{
							$str .="		\$returnField = '".$pk_id.",".str_replace('|',',',$val['fields'])."';\n";
						}
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$data,\$returnField);\n";
						if(empty($uid)){
							$uid = $pk_id;
						}
						$str .="		return \$this->ajaxReturn(\$this->successCode,'登陆成功',\$res,\$this->setToken(\$res['".$uid."']));\n";
						$str .="	}\n\n";
					}
					
				break;
				
				//手机号登录
				case 19:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$str .="	* @api {post} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$str .="	\n";
						if(!empty($val['remark'])){
							list($username,$uid) = explode('|',$val['remark']);
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="	* @apiParam (输入参数：) {string}     		mobile 登录手机号\n";
						if($val['sms_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		mobile 短信验证手机号\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify_id 短信验证ID\n";
							$str .="	* @apiParam (输入参数：) {string}     		verify 短信验证码\n";
						}
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$mobile = \$this->request->post('mobile','post',null);\n";
						$str .="		if(empty(\$mobile)) throw new ValidateException('手机号不能为空');\n";
						if(empty($val['fields'])){
							$str .="		\$returnField = '*';\n";
						}else{
							$str .="		\$returnField = '".$pk_id.",".str_replace('|',',',$val['fields'])."';\n";
						}
						$str .="		\$res = ".getControllerName($menuInfo['controller_name'])."Service::".$val['action_name']."(\$mobile,\$returnField);\n";
						if(empty($uid)){
							$uid = $pk_id;
						}
						$str .="		return \$this->ajaxReturn(\$this->successCode,'登陆成功',\$res,\$this->setToken(\$res['".$uid."']));\n";
						$str .="	}\n\n";
					}
					
				break;
				
				//发送短信验证码
				case 18:
					if($val['is_controller_create'] !== 0){
						$str .="	/**\n";
						$request_type = !empty($val['request_type']) ? $val['request_type'] : 'post';
						$str .="	* @api {".$request_type."} /".getUrlName($menuInfo['controller_name'])."/".$val['action_name']." ".sprintf('%02d', ($key+1))."、".$val['name']."\n";
						if($note_status){
						$str .="	* @apiGroup ".getControllerName($menuInfo['controller_name'])."\n";
						$str .="	* @apiVersion 1.0.0\n";
						$description = !empty($val['block_name']) ? $val['block_name'] : $val['name'];
						$str .="	* @apiDescription  ".$description."\n";
						$str .="	\n";
						if(!empty($val['remark'])){
							list($username,$password,$uid) = explode('|',$val['remark']);
						}
						if($val['captcha_auth']){
							$str .="	* @apiParam (输入参数：) {string}     		captcha 图片验证码\n";
							$str .= "\n";
						}
						$str .="	* @apiParam (输入参数：) {string}     		mobile 手机号\n";
						$str .="\n";
						$str .="	* @apiParam (失败返回参数：) {object}     	array 返回结果集\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.status 返回错误码 ".config('my.errorCode')."\n";
						$str .="	* @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array 返回结果集\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.status 返回错误码 ".config('my.successCode')."\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.msg 返回成功消息\n";
						$str .="	* @apiParam (成功返回参数：) {string}     	array.key 返回短信验证ID\n";
						$str .="	* @apiSuccessExample {json} 01 成功示例\n";
						$str .="	* {\"status\":\"".config('my.successCode')."\",\"msg\":\"操作成功\"}\n";
						$str .="	* @apiErrorExample {json} 02 失败示例\n";
						$str .="	* {\"status\":\"".config('my.errorCode')."\",\"msg\":\"操作失败\"}\n";
						}
						$str .="	*/\n";
						$str .= "	function ".$val['action_name']."(){\n";
						$str .="		\$mobile = \$this->request->".$request_type."('mobile');\n";
						$str .="		if(empty(\$mobile)) throw new ValidateException ('手机号不能为空');\n";
						$str .="		if(!preg_match('/^1[3456789]\d{9}$/',\$mobile)) throw new ValidateException ('手机号格式错误');\n";
						$str .="		try{\n";
						$str .="			\$data['mobile']	= \$mobile;	//发送手机号\n";
						$str .="			\$data['code']	= sprintf('%06d', rand(0,999999));		//验证码\n";
						if(empty($val['remark'])){
							$str .="			\$res = \utils\sms\AliSmsService::sendSms(\$data);\n";
						}else{
							$str .="			\$res = \utils\sms\\".$val['remark']."SmsService::sendSms(\$data);\n";
						}
						$str .="		}catch(\\Exception \$e){\n";
						$str .="			abort(config('my.error_log_code'),\$e->getMessage());\n";
						$str .="		}\n";
						
						$str .="		\$key = md5(time().\$data['mobile']);\n";
						$str .="		cache(\$key,['mobile'=>\$data['mobile'],'code'=>\$data['code']],".$val['cache_time'].");\n";
						$str .="		return json(['status'=>\$this->successCode,'msg'=>'发送成功','key'=>\$key]);\n";
						$str .="	}\n\n";
					}
				break;
				
				default:
					$str .= ExtendService::getApiExtendFuns($val,$fieldList);
				
			}
		}
		//生成控制器 服务层 数据库文件
		try{
			$rootPath = app()->getRootPath();
			$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/controller/'.$menuInfo['controller_name'].'.php';
			filePutContents($str,$filepath,$type=1);

			$this->createApiService($actionList,$applicationInfo,$menuInfo); //根据应用生成相应的服务层代码 
			$this->createModel($actionList,$applicationInfo,$menuInfo); //根据应用生成相应的服务层代码
			$this->createValidate($actionList,$applicationInfo,$menuInfo); //根据应用生成相应的验证器
			$this->createRoute($applicationInfo); //生成接口路由文件
			
		}catch(\Exception $e){
			$this->error($e->getMessage());
		}
		
		return true;
	}
	
	
	
	
	/**
     * 生成api服务层代码
     * @param array applicationInfo 应用信息
	 * @param array actionList 操作列表
	 * @param array menuInfo 菜单信息
     * @throws \Exception
     * @return bool
     */
	public function createApiService($actionList,$applicationInfo,$menuInfo){
		if($actionList){
			$str = '';
			$str = "<?php \n";
			!is_null(config('my.comment.file_comment')) ? config('my.comment.file_comment') : true;
			if(config('my.comment.file_comment')){
			$str .= "/*\n";
			$str .= " module:		".$menuInfo['title']."\n";
			$str .= " create_time:	".date('Y-m-d H:i:s')."\n";
			$str .= " author:		".config('my.comment.author')."\n";
			$str .= " contact:		".config('my.comment.contact')."\n";
			$str .= "*/\n\n";
			}
			$str .= "namespace app\\".$applicationInfo['app_dir']."\\service".getDbName($menuInfo['controller_name']).";\n";
			if($menuInfo['table_name']){
				$str .= "use app\\".$applicationInfo['app_dir']."\\model\\".getUseName($menuInfo['controller_name']).";\n";
			}
			$str .= "use think\\facade\\Log;\n";
			$str .= "use think\\exception\\ValidateException;\n";
			$str .= "use xhadmin\CommonService;\n";
			$str .="\n";
			$str .= "class ".getControllerName($menuInfo['controller_name'])."Service extends CommonService {\n\n\n";
			$fieldList = htmlOutList(Field::where(['menu_id'=>$menuInfo['menu_id']])->select());
			
			foreach($actionList as $key=>$val){
				if($val['is_service_create'] !== 0){
					switch($val['type']){
						
						//数据列表
						case 1:
							if(empty($val['sql_query'])){	
								$str .="	/*\n";
								$str .=" 	* @Description  ".$val['block_name']."列表数据\n";
								$str .=" 	*/\n";
								$str .= "	public static function ".$val['action_name']."List(\$where,\$field,\$orderby,\$limit,\$page){\n";
								$str .= "		try{\n";
								if(!empty($val['fields']) && !empty($val['relate_field']) && !empty($val['relate_table'])){
									if($menuInfo['connect']){
										$str .= "			\$res = db('".$menuInfo['table_name']."','".$menuInfo['connect']."')->field(\$field)->alias('a')->join('".$val['relate_table']." b','a.".$val['fields']."=b.".$val['relate_field']."','left')->where(\$where)->order(\$orderby)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
									}else{
										$str .= "			\$res = db('".$menuInfo['table_name']."')->field(\$field)->alias('a')->join('".$val['relate_table']." b','a.".$val['fields']."=b.".$val['relate_field']."','left')->where(\$where)->order(\$orderby)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
									}
									
								}else{
									$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->field(\$field)->order(\$orderby)->paginate(['list_rows'=>\$limit,'page'=>\$page])->toArray();\n";
								}
								$str .= "		}catch(\Exception \$e){\n";
								if(config('my.error_log_code')){
									$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
								}else{
									$str .= "			abort(500,\$e->getMessage());\n";
								}
								$str .= "		}\n";
								$str .= "		return ['list'=>\$res['data'],'count'=>\$res['total']];\n";
								$str .= "	}\n\n\n";	
							}
						break;
						
						
						
						//添加数据
						case 3:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							if($val['relate_table']){
								$str .="			db()->startTrans();\n\n";
							}
							foreach($fieldList as $k=>$v){
								if(in_array($v['field'],explode(',',$val['fields']))){
									//日期框
									if($v['type'] == 7){
										$fieldData .= "			\$data['".$v['field']."'] = strtotime(\$data['".$v['field']."']);\n";
									}else if($v['type'] == 5){
										if(config('my.password_secrect')){
											$str .= "			\$data['".$v['field']."'] = md5(\$data['".$v['field']."'].config('my.password_secrect'));\n";
										}else{
											$str .= "			\$data['".$v['field']."'] = md5(\$data['".$v['field']."']);\n";
										}
									}else if($v['type'] == 12){
										$fieldData .= "			\$data['".$v['field']."'] = time();\n";
									}else if($v['type'] == 21){
										$fieldData .= "			\$data['".$v['field']."'] = random(".$v['default_value'].",'all');\n";
									}else if($v['type'] == 26){
										$fieldData .= "			\$data['".$v['field']."'] = request()->ip();\n";
									}else if($v['type'] == 30){
										$default_value = !empty($v['default_value']) ? $v['default_value'] : '000';
										$fieldData .= "			\$data['".$v['field']."'] = doOrderSn('".$default_value."');\n";
									}else{
										$value = (string) $v['default_value'];
										if($value || $value == '0'){
											$fieldData .= "			\$data['".$v['field']."'] = !is_null(\$data['".$v['field']."']) ? \$data['".$v['field']."'] : '".$value."';\n";
										}
									}
								}
							}
							
							$str .= $fieldData;
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::create(\$data);\n";
							if($val['relate_table']){
								$str .="			\$data['".$menuInfo['pk_id']."'] = \$res->".$menuInfo['pk_id'].";\n";
								$str .="			db('".$val['relate_table']."')->insert(\$data);\n\n";
								$str .="			db()->commit();\n";
							}
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if($val['relate_table']){
									$str .="			db()->rollback();\n";
							}
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res->".$menuInfo['pk_id'].";\n";
							$str .= "	}\n\n\n";
							$rule = '';
							$msg = '';
							$fieldData = '';
						break;
						
						
						//修改数据
						case 4:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$where,\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							if($val['relate_table']){
								$str .="			db()->startTrans();\n\n";
							}
							foreach($fieldList as $k=>$v){
								if(in_array($v['field'],explode(',',$val['fields']))){
									//判断是否有日期框的
									if(in_array($v['type'],[7,12])){
										$fieldData .= "			!is_null(\$data['".$v['field']."']) && \$data['".$v['field']."'] = strtotime(\$data['".$v['field']."']);\n";
									}elseif($v['type'] == 25){
										$fieldData .= "			\$data['".$v['field']."'] = time();\n";
									}
								}
							}
							
							$str .= $fieldData;
							
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->update(\$data);\n";
							if($val['relate_table']){
									$str .="			db('".$val['relate_table']."')->where('".$menuInfo['pk_id']."',\$data['".$menuInfo['pk_id']."'])->update(\$data);\n\n";
									$str .="			db()->commit();\n";
							}
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if($val['relate_table']){
								$str .="			db()->rollback();\n";
							}
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
							$rule = '';
							$msg = '';
							$field ='';
							$validate ='';
							$fieldData = '';
						break;
						
						//充值
						case 7:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$where,\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->inc('".$val['fields']."',\$data['".$val['fields']."'])->update();\n";
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
						break;
						
						//回收
						case 8:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$where,\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							$str .="			\$info = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->find();\n";
							$str .="			if(\$info->".$val['fields']." < \$data['".$val['fields']."']) throw new ValidateException('操作数据不足');\n";
							$str .= "			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->dec('".$val['fields']."',\$data['".$val['fields']."'])->update();\n";
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
						break;
						
						//重置密码
						case 9:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$where,\$data){\n";
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							if(BuildService::checkValidateStatus($val['fields'],$validateFields)){
								$str .="			validate(\\app\\".$applicationInfo['app_dir']."\\validate\\".getUseName($menuInfo['controller_name'])."::class)->scene('".$val['action_name']."')->check(\$data);\n";
							}
							if(config('my.password_secrect')){
								$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->update(['".$val['fields']."'=>md5(\$data['".$val['fields']."'].config('my.password_secrect'))]);\n";
							}else{
								$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."::where(\$where)->update(['".$val['fields']."'=>md5(\$data['".$val['fields']."'])]);\n";
							}
							$str .= "		}catch(ValidateException \$e){\n";
							$str .="			throw new ValidateException (\$e->getError());\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .= "		return \$res;\n";
							$str .= "	}\n\n\n";
						break;
						
						
						//账号密码登录
						case 17:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$data,\$returnField){\n";
							if($val['remark']){
								list($username,$password,$uid) = explode('|',$val['remark']);
								$str .="		\$where['".$username."'] = \$data['".$username."'];\n";
								if(config('my.password_secrect')){
									$str .="		\$where['".$password."'] = md5(\$data['".$password."'].config('my.password_secrect'));\n";
								}else{
									$str .="		\$where['".$password."'] = md5(\$data['".$password."']);\n";
								}
							}
							$str .= "		try{\n";
							foreach($fieldList as $k=>$v){
								if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,20,21,25,30])){
									$validateFields[] = $v['field'];
								}
							}
							$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."::field(\$returnField)->where(\$where)->find();\n";
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .="		if(!\$res){\n";
							$str .="			throw new ValidateException('请检查用户名或者密码');\n";
							$str .="		}\n";
							$str .= "		return checkData(\$res,false);\n";
							$str .= "	}\n\n\n";
						break;
						
						//手机号登录
						case 19:
							$str .="	/*\n";
							$str .=" 	* @Description  ".$val['block_name']."\n";
							$str .=" 	*/\n";
							$str .= "	public static function ".$val['action_name']."(\$mobile,\$returnField){\n";
							$str .= "		try{\n";
							if($val['remark']){
								$username = explode('|',$val['remark'])[0];
								$str .="			\$where['".$username."'] = \$mobile;\n";
								$str .="			\$res = ".getControllerName($menuInfo['controller_name'])."::field(\$returnField)->where(\$where)->find();\n";	
							}
							$str .= "		}catch(\Exception \$e){\n";
							if(config('my.error_log_code')){
								$str .= "			abort(config('my.error_log_code'),\$e->getMessage());\n";
							}else{
								$str .= "			abort(500,\$e->getMessage());\n";
							}
							$str .= "		}\n";
							$str .="		if(!\$res){\n";
							$str .="			throw new ValidateException('请检查手机号');\n";
							$str .="		}\n";
							$str .= "		return checkData(\$res,false);\n";
							$str .= "	}\n\n\n";
						break;
					}
				}
			}
			
			$rootPath = app()->getRootPath();
			$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/service/'.$menuInfo['controller_name'].'Service.php';
			filePutContents($str,$filepath,$type=1);
		}	
	}
	
	/**
     * 生成模型
     * @param array applicationInfo 应用信息
	 * @param array actionList 操作列表
	 * @param array menuInfo 菜单信息
     * @throws \Exception
     * @return bool
     */
	public function createModel($actionList,$applicationInfo,$menuInfo){
		$str = '';
		$str = "<?php \n";
		!is_null(config('my.comment.file_comment')) ? config('my.comment.file_comment') : true;
		if(config('my.comment.file_comment')){
		$str .= "/*\n";
		$str .= " module:		".$menuInfo['title']."模型\n";
		$str .= " create_time:	".date('Y-m-d H:i:s')."\n";
		$str .= " author:		".config('my.comment.author')."\n";
		$str .= " contact:		".config('my.comment.contact')."\n";
		$str .= "*/\n\n";
		}
		$str .= "namespace app\\".$applicationInfo['app_dir']."\\model".getDbName($menuInfo['controller_name']).";\n";
		$str .="use think\Model;\n";
		
		
		$softDeleteAction =  db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>31])->value('action_name');
		
		if($softDeleteAction){
			$str .="use think\model\concern\SoftDelete;\n";
		}
		
		
		$str .="\n";
		$str .= "class ".getControllerName($menuInfo['controller_name'])." extends Model {\n\n\n";
		if($softDeleteAction){
			$delete_field = !is_null(config('my.delete_field')) ? config('my.delete_field') : 'delete_time'; 
			$str .="	use SoftDelete;\n\n";
			$str .="	protected \$deleteTime = '".$delete_field."';\n\n";
		}
		
		if($menuInfo['connect']){
			$str .="	protected \$connection = '".$menuInfo['connect']."';\n\n ";
		}
		
		$str .="	protected \$pk = '".$menuInfo['pk_id']."';\n\n ";
		$str .="	protected \$name = '".$menuInfo['table_name']."';\n ";
		
		$rootPath = app()->getRootPath();
		$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/model/'.$menuInfo['controller_name'].'.php';
		filePutContents($str,$filepath,$type=1);
	}
	
	
	
	/**
     * 生成列表模板html页面
     * @param array applicationInfo 应用信息
	 * @param array menuInfo 菜单信息
	 * @param array actionInfo 方法信息
     * @param array fieldList 字段信息
	 * @return str
     */
	public function createIndexTpl($applicationInfo,$menuInfo,$actionInfo,$fieldList,$actionList){
		
		$fieldList = $fieldList->toArray();
		$htmlstr = '';
		$htmlstr .= "{extend name='common/_container'} {block name=\"content\"}\n";
		$htmlstr .= "<div class=\"row\">\n";
		$htmlstr .= "	<div class=\"col-sm-12\">\n";
		$htmlstr .= "		<div class=\"ibox float-e-margins\">\n";
		$list_title_status = !is_null(config('my.list_title_status')) ? config('my.list_title_status') : true; 
		if($list_title_status && $actionInfo['block_name']){
		$htmlstr .= "			<div class=\"alert alert-dismissable\" style=\"border-left: 5px solid #009688;border-radius: 0 2px 2px 0;background-color: #f2f2f2;\">\n";
		$htmlstr .= "				".html_out($actionInfo['block_name'])."\n";
		$htmlstr .= "				<button aria-hidden=\"true\" data-dismiss=\"alert\" class=\"close\" type=\"button\">×</button>\n";
		$htmlstr .= "			</div>\n";
		}
		$htmlstr .= "			<div class=\"ibox-content\"> \n";
		$htmlstr .= "				<div class=\"row row-lg\"> \n";
		$htmlstr .= "					<div class=\"col-sm-12\"> \n";
		$htmlstr .= "						<div class=\"row\" id=\"searchGroup\">\n";		
		/*开始生成搜索框*/
		foreach($fieldList as $key=>$val){
			if($val['search_show'] == 1){
			//定义文本框、下拉框、单选框、后台创建时间框、三级联动才生成搜选项
				if(in_array($val['type'],[1,2,3,4,6,7,12,13,17,20,21,23,27,28,29,30])){
					switch($val['type']){
						
						case 7:  //生成时间区间搜搜
							$htmlstr .= BuildService::createTimeSearch($val);
						break;
						
						case 12:  //生成时间区间搜搜
							$htmlstr .= BuildService::createTimeSearch($val);
						break;
						
						case 13:  //生成货币区间搜搜
							$htmlstr .= BuildService::createNumSearch($val);
						break;
						
						case 17:  //生成三级联动
							$htmlstr .= BuildService::createDistaitSearch($val);
						break;
						
						default:  //其它选项生成
							$htmlstr .= BuildService::createNormaiSearch($val);
					}
					$searchStatus = true;
				}
				
			}
		}
		$htmlstr .= "							<!-- search end -->\n";
		$reset_button_status = !is_null(config('my.reset_button_status')) ? config('my.reset_button_status') : true; 
		if($searchStatus){
			if($reset_button_status){
				$htmlstr .= "							<div class=\"col-sm-2\">\n";
			}else{
				$htmlstr .= "							<div class=\"col-sm-1\">\n";
			}
		$htmlstr .= "								<button type=\"button\" class=\"btn btn-success \" onclick=\"CodeGoods.search()\" id=\"\">\n";
		$htmlstr .= "									<i class=\"fa fa-search\"></i>&nbsp;搜索\n";
		$htmlstr .= "								</button>\n";
		
		
		if($reset_button_status){
			$htmlstr .= "								<button type=\"button\" class=\"btn\" onclick=\"CodeGoods.reset()\" id=\"\">\n";
			$htmlstr .= "									<i class=\"glyphicon glyphicon-share-alt\"></i>&nbsp;重置\n";
			$htmlstr .= "								</button>\n";
		}
		$htmlstr .= "							</div>\n";
		}
		$htmlstr .= "						</div>\n";
		/*搜索框生成完毕*/
		
		/*开始生成按钮操作组*/
		$htmlstr .= "						<div class=\"btn-group-sm\" id=\"CodeGoodsTableToolbar\" role=\"group\">\n";
		foreach($actionList as $key=>$val){
			if($val['is_view'] && $val['type'] <> 1){
				$buttonGroup[$key]= $val;  //table头部按钮组
			}	
			if(!in_array($val['type'],[1,16,30])){
				$scriptGroup[$key]= $val;  //table头部按钮组
			}	
			if($val['button_status'] == 1){
				$buttonList[$key]= $val;  //table列表按钮组
			}
		}
		
		foreach($buttonGroup as $k=>$v){
			$btn_color = !empty($v['lable_color']) ? $v['lable_color'] : 'primary';  //默认按钮颜色
			$action_url = empty($v['jump']) ? $applicationInfo['app_dir']."/".getUrlName($menuInfo['controller_name'])."/".$v['action_name'] : $applicationInfo['app_dir'].$v['jump'];
			$htmlstr .= "						{if condition=\"in_array('".$action_url."',session('".$applicationInfo['app_dir'].".nodes')) || session('".$applicationInfo['app_dir'].".role_id') eq 1\"}\n";
			$htmlstr .= "						<button type=\"button\" id=\"".$v['action_name']."\" class=\"btn btn-".$btn_color." button-margin\" onclick=\"CodeGoods.".$v['action_name']."()\">\n";
			
			$bs_icon = !empty($v['bs_icon']) ? $v['bs_icon'] : 'fa fa-pencil';
			if(in_array($v['bs_icon'],['plus','pencil','edit','trash','plus','download','upload'])){
				$bs_icon = 'fa fa-'.$v['bs_icon'];
			}
			$htmlstr .="						<i class=\"".$bs_icon."\"></i>&nbsp;".$v['name']."\n";
			$htmlstr .="						</button>\n";
			$htmlstr .="						{/if}\n";	
		}
		$htmlstr .= "						</div>\n";
		/*按钮组生成完毕*/
		
		//table表格开始
		$htmlstr .="						<table id=\"CodeGoodsTable\" data-mobile-responsive=\"true\" data-click-to-select=\"true\">\n";
		$htmlstr .="							<thead><tr><th data-field=\"selectItem\" data-checkbox=\"true\"></th></tr></thead>\n";
		$htmlstr .="						</table>\n";
		$htmlstr .="					</div>\n";
		$htmlstr .="				</div>\n";
		$htmlstr .="			</div>\n";
		$htmlstr .="		</div>\n";
		$htmlstr .="	</div>\n";
		$htmlstr .="</div>\n";
		/*表格结束*/
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['type'],[29])){
				$chosen_status = true;
			}
		}
		if($chosen_status){
			$htmlstr .= "<link href='__PUBLIC__/static/js/plugins/chosen/chosen.min.css' rel='stylesheet'/>\n";
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/chosen/chosen.jquery.js'></script>\n";
			$htmlstr .="<script>\$(function(){\$('.chosen').chosen({search_contains: true})})</script>\n";
		}
		
		$htmlstr .="<script>\n";
		$htmlstr .="	var CodeGoods = {id: \"CodeGoodsTable\",seItem: null,table: null,layerIndex: -1};\n\n";
		
		/*表格数据列表开始*/
		$htmlstr .="	CodeGoods.initColumn = function () {\n";
		$htmlstr .=" 		return [\n";
		$select_type = $actionInfo['select_type']  == 1 ? 'radio' : 'checkbox';
		$htmlstr .=" 			{field: 'selectItem', ".$select_type.": true},\n";
		$sortidField =  db("field")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>22])->value('field');
		$sortAction = db("action")->where(['menu_id'=>$menuInfo['menu_id'],'type'=>30])->value('action_name');
		if($sortidField && $sortAction && $actionInfo['type'] == 1){
			$htmlstr .=" 			{title: '排序', field: '".$menuInfo['pk_id']."', visible: true, align: 'center', valign: 'middle',formatter: 'CodeGoods.arrowFormatter'},\n";
		}
		
		$show_fields = $fieldList;
		
		if($actionInfo['fields']){
			$list_fields = $menuInfo['pk_id'].','.$actionInfo['fields'];
			$show_fields = [];
			foreach($fieldList as $m=>$n){
				if(in_array($n['field'],explode(',',$list_fields))){
					$show_fields[] = $n;
				}
			}
		}
		
		if($actionInfo['relate_table'] && $actionInfo['relate_field']){
			$show_fields = $fieldList;
		}

		foreach($show_fields as $k=>$v){
			if(in_array($v['list_show'],[1,2])){
				$show_type = $v['list_show'] == 1 ? 'true' : 'false';
				//存在配置字段 日期字段 图片字段 三级联动生成字段格式化方法
				if(!empty($v['config']) || in_array($v['type'],[7,8,9,10,12,17,22,25,34])){
					if($v['type'] == 17){
						$htmlstr .=" 			{title: '".$v['name']."', field: '".$v['field']."', visible: ".$show_type.", align: '".$v['align']."', valign: 'middle',sortable: true,formatter:CodeGoods.".str_replace('|','',$v['field'])."Formatter },\n";
					}else{
						$htmlstr .=" 			{title: '".$v['name']."', field: '".$v['field']."', visible: ".$show_type.", align: '".$v['align']."', valign: 'middle',sortable: true,formatter:CodeGoods.".$v['field']."Formatter},\n";
					}				
				}else{
					$htmlstr .=" 			{title: '".$v['name']."', field: '".$v['field']."', visible: ".$show_type.", align: '".$v['align']."', valign: 'middle',sortable: true},\n";
				}
			}
		}
		$show_fields = '';
		
		//格式化列表按钮	
		if($buttonList){
			$htmlstr .=" 			{title: '操作', field: '', visible: true, align: '".$v['align']."', valign: 'middle',formatter: 'CodeGoods.buttonFormatter'},\n";
		}
		
		$htmlstr .=" 		];\n";
		$htmlstr .=" 	};\n\n";
		/*表格数据列表结束*/
		
		
		
		if($buttonList){
			$htmlstr .="	CodeGoods.buttonFormatter = function(value,row,index) {\n";
			$htmlstr .="		if(row.".$menuInfo['pk_id']."){\n";
			$htmlstr .="			var str= '';\n";
			
			foreach($buttonList as $key=>$val){
				$action_url = empty($val['jump']) ? $applicationInfo['app_dir']."/".getUrlName($menuInfo['controller_name'])."/".$val['action_name'] : $applicationInfo['app_dir'].$val['jump'];
				$htmlstr .= "			{if condition=\"in_array('".$action_url."',session('".$applicationInfo['app_dir'].".nodes')) || session('".$applicationInfo['app_dir'].".role_id') eq 1\"}\n";
				$bs_icon = !empty($val['bs_icon']) ? $val['bs_icon'] : 'fa fa-pencil';
				if(in_array($val['bs_icon'],['plus','edit','pencil','trash','plus','download','upload'])){
					$bs_icon = 'fa fa-'.$val['bs_icon'];
				}
				if(in_array($val['type'],[10,11]) && $val['fields']){
					foreach(explode(',',$val['fields']) as $m=>$n){
						$hiden_fileld .= '\\\'\'+row.'.$n.'+\'\\\',';
					}
					$htmlstr .= "			str += '<button type=\"button\" class=\"btn btn-".$val['lable_color']." btn-xs\" title=\"".$val['name']."\"  onclick=\"CodeGoods.".$val['action_name']."('+row.".$menuInfo['pk_id']."+',".rtrim($hiden_fileld,',').")\"><i class=\"".$bs_icon."\"></i>&nbsp;".$val['name']."</button>&nbsp;';\n";
				}else{
					$htmlstr .= "			str += '<button type=\"button\" class=\"btn btn-".$val['lable_color']." btn-xs\" title=\"".$val['name']."\"  onclick=\"CodeGoods.".$val['action_name']."('+row.".$menuInfo['pk_id']."+')\"><i class=\"".$bs_icon."\"></i>&nbsp;".$val['name']."</button>&nbsp;';\n";
				}
				$htmlstr .="			{/if}\n";
				$hiden_fileld = '';
			}
			
			$htmlstr .="			return str;\n";
			$htmlstr .="		}\n";
			$htmlstr .="	}\n\n";
			
		}
		
		if($sortidField){
			$htmlstr .="	CodeGoods.arrowFormatter = function(value,row,index) {\n";
			$htmlstr .="		return '<i class=\"fa fa-long-arrow-up\" onclick=\"CodeGoods.arrowsort('+row.".$menuInfo['pk_id']."+','+row.".$sortidField."+',1)\" style=\"cursor:pointer;\" title=\"上移\"></i>&nbsp;<i class=\"fa fa-long-arrow-down\" style=\"cursor:pointer;\" onclick=\"CodeGoods.arrowsort('+row.".$menuInfo['pk_id']."+','+row.".$sortidField."+',2)\"  title=\"下移\"></i>';\n";
			$htmlstr .="	}\n\n";
			
			
			$htmlstr .="	CodeGoods.arrowsort = function (pk,sortid,type) {\n";
			$htmlstr .="		var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/".$sortAction."\", function (data) {\n";
			$htmlstr .="			if ('00' === data.status) {\n";
			$htmlstr .="				Feng.success(data.msg);\n";
			$htmlstr .="				CodeGoods.table.refresh();\n";
			$htmlstr .="			} else {\n";
			$htmlstr .="				Feng.error(data.msg);\n";
			$htmlstr .="			}\n";
			$htmlstr .="		});\n";
			$htmlstr .="		ajax.set('".$menuInfo['pk_id']."', pk);\n";
			$htmlstr .="		ajax.set('type', type);\n";
			$htmlstr .="		ajax.set('sortid', sortid);\n";
			$htmlstr .="		ajax.start();\n";
			$htmlstr .="	}\n\n";
		}
		
		//构建格式化方法
		foreach($fieldList as $k=>$v){
			if(in_array($v['list_show'],[1,2])){
				//列表添加背景标签
				if(!empty($v['config']) && ($v['type'] == 1 || $v['type'] == 13)){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$htmlstr .="			return '<span class=\"label label-".$v['config']."\">'+value+'</span>';\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//格式化单选框 下拉框
				if(in_array($v['type'],[2,3,29])){
					if(!empty($v['config'])){	
						$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
						$htmlstr .="		if(value !== null){\n";
						$htmlstr .="			var value = value.toString();\n";
						$htmlstr .="			switch(value){\n";
						$data = explode(',',$v['config']);
						if($data && count($data) > 1){
							foreach($data as $key=>$val){
								$valArr = explode('|',$val);
								if($valArr){
									$htmlstr .="				case '".$valArr[1]."':\n";
									if(!empty($valArr[2])){
										$htmlstr .="					return '<span class=\"label label-".trim($valArr[2])."\">".$valArr[0]."</span>';\n";
									}else{
										$htmlstr .="					return '".$valArr[0]."';\n";
									}
									$htmlstr .="				break;\n";
								}
							}
						}
						
						$htmlstr .="			}\n";
						$htmlstr .="		}\n";
						$htmlstr .="	}\n\n";
					}
				}
				
				//格式化时间
				if(in_array($v['type'],[4,27]) && !empty($v['config']) && empty($v['sql'])){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$htmlstr .="			return getCheckBoxValue(value,'".$v['config']."');	\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//格式化时间
				if($v['type'] == 7 || $v['type'] == 12 || $v['type'] == 25){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$default_time_format = explode('|',$v['default_value']);
					$time_format = $default_time_format[0];
					if(!$time_format || $v['default_value'] == 'null'){
						$time_format = 'Y-m-d H:i:s';
					}
					$htmlstr .="			return formatDateTime(value,'".$time_format."');	\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//格式化显示图片
				if($v['type'] == 8){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$htmlstr .="			return \"<a href=\\\"javascript:void(0)\\\" onclick=\\\"openImg('\"+value+\"')\\\"><img height='30' src=\"+value+\"></a>\";	\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//格式化显示多图
				if($v['type'] == 9){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$htmlstr .="			var img = JSON.parse(row.".$v['field'].".replace(/&quot;/g,'\"'));	\n";
					$htmlstr .="			var imgs = '';	\n";
					$htmlstr .="			for(var i in img) {	\n";
					$htmlstr .="				if(img[i][\"url\"]){	\n";
					$htmlstr .="					imgs += \"<a href=\\\"javascript:void(0)\\\" onclick=\\\"openImg('\"+img[i][\"url\"]+\"')\\\"><img height='30' src=\"+img[i][\"url\"]+\"></a>&nbsp;\";	\n";
					$htmlstr .="				}\n";
					$htmlstr .="			}\n";
					$htmlstr .="			return imgs;\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//下载附件
				if($v['type'] == 10){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$htmlstr .="			return \"<a target='_blank' href=\\\"\"+value+\"\\\">下载附件</a>\";	\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//格式化多文件
				if($v['type'] == 34){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		if(value){\n";
					$htmlstr .="			var files = row.".$v['field'].".split('|');	\n";
					$htmlstr .="			var file = '';	\n";
					$htmlstr .="			for(var i in files) {	\n";
					$htmlstr .="				if(files[i]){	\n";
					$htmlstr .="					file += \"<a href=\\\"\"+files[i]+\"\\\">附件下载\"+(parseInt(i)+1)+\"</a>&nbsp;&nbsp;\";	\n";
					$htmlstr .="				}\n";
					$htmlstr .="			}\n";
					$htmlstr .="			return file;\n";
					$htmlstr .="		}\n";
					$htmlstr .="	}\n\n";
				}
				
				//格式化三级联动
				if($v['type'] == 17){
					$htmlstr .="	CodeGoods.".str_replace('|','',$v['field'])."Formatter = function(value,row,index) {\n";
					$htmlstr .="		 var areaStr = '';\n";
					foreach(explode('|',$v['field']) as $m=>$n){
						$htmlstr .="		 if(row.".$n."){\n";
						$htmlstr .="		 	areaStr += \"-\"+row.".$n.";\n";
						$htmlstr .="		 }\n";
					}
					$htmlstr .="		areaStr = areaStr.substr(1);\n";
					$htmlstr .="		return areaStr;\n";
					$htmlstr .="	}\n\n";
				}
				
				//排序
				if($v['type'] == 22){
					$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
					$htmlstr .="		return '<input type=\"text\" value=\"'+value+'\" onblur=\"CodeGoods.update".$v['field']."('+row.".$menuInfo['pk_id']."+',this.value)\" style=\"width:50px; border:1px solid #ddd; text-align:center\">';\n";
					$htmlstr .="	}\n\n\n";
					
					$htmlstr .="	CodeGoods.update".$v['field']." = function(pk,value) {\n";
					$htmlstr .="		var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/updateExt\", function (data) {\n";
					$htmlstr .="			if ('00' === data.status) {\n";
					$htmlstr .="			} else {\n";
					$htmlstr .="				Feng.error(data.msg);\n";
					$htmlstr .="			}\n";
					$htmlstr .="		});\n";
					$htmlstr .="		ajax.set('".$menuInfo['pk_id']."', pk);\n";
					$htmlstr .="		ajax.set('".$v['field']."', value);\n";
					$htmlstr .="		ajax.start();\n";
					$htmlstr .="	}\n\n";
				}
				
				//开关按钮
				if($v['type'] == 23){	
					$listData = explode(',',$v['config']);
					if(count($listData) == 2){
						$onData = explode('|',$listData[0]);
						$offData = explode('|',$listData[1]);
						
						$htmlstr .="	CodeGoods.".$v['field']."Formatter = function(value,row,index) {\n";
						$htmlstr .="		if(value !== null){\n";
						$htmlstr .="			if(value == ".$onData[1]."){\n";
						$htmlstr .="				return '<input class=\"mui-switch mui-switch-animbg ".$v['field']."'+row.".$menuInfo['pk_id']."+'\" type=\"checkbox\" onclick=\"CodeGoods.update".$v['field']."('+row.".$menuInfo['pk_id']."+',".$offData[1].",\'".$v['field']."\')\" checked>';\n";
						$htmlstr .="			}else{\n";
						$htmlstr .="				return '<input class=\"mui-switch mui-switch-animbg ".$v['field']."'+row.".$menuInfo['pk_id']."+'\" type=\"checkbox\" onclick=\"CodeGoods.update".$v['field']."('+row.".$menuInfo['pk_id']."+',".$onData[1].",\'".$v['field']."\')\">';\n";
						$htmlstr .="			}\n";
						$htmlstr .="		}\n";
						$htmlstr .="	}\n\n\n";
						
						$htmlstr .="	CodeGoods.update".$v['field']." = function(pk,value,field) {\n";
						$htmlstr .="		var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/updateExt\", function (data) {\n";
						$htmlstr .="			if ('00' !== data.status) {\n";
						$htmlstr .="				Feng.error(data.msg);\n";
						$htmlstr .="				$(\".\"+field+pk).prop(\"checked\",!$(\".\"+field+pk).prop(\"checked\"));\n";
						$htmlstr .="			}\n";
						$htmlstr .="		});\n";
						$htmlstr .="		var val = $(\".\"+field+pk).prop(\"checked\") ? 1 : 0;\n";
						$htmlstr .="		ajax.set('".$menuInfo['pk_id']."', pk);\n";
						$htmlstr .="		ajax.set('".$v['field']."', val);\n";
						$htmlstr .="		ajax.start();\n";
						$htmlstr .="	}\n\n";
					}
				}
			}	
		}
		
		//构建查询操作数据
		$htmlstr .="	CodeGoods.formParams = function() {\n";
		$htmlstr .="		var queryData = {};\n";
		$htmlstr .="		queryData['offset'] = 0;\n";
		foreach($fieldList as $k=>$v){
			if($v['search_show'] == 1){
				switch($v['type']){
					
					//时间段搜素
					case 7:
						$htmlstr .="		queryData['".$v['field']."_start'] = $(\"#".$v['field']."\").val().split(\" - \")[0];\n";
						$htmlstr .="		queryData['".$v['field']."_end'] = $(\"#".$v['field']."\").val().split(\" - \")[1];\n";
					break;
					
					//时间段搜素
					case 12:
						$htmlstr .="		queryData['".$v['field']."_start'] = $(\"#".$v['field']."\").val().split(\" - \")[0];\n";
						$htmlstr .="		queryData['".$v['field']."_end'] = $(\"#".$v['field']."\").val().split(\" - \")[1];\n";
					break;
					
					//货币段搜素
					case 13:
						$htmlstr .="		queryData['".$v['field']."_start'] = $(\"#".$v['field']."_start\").val();\n";
						$htmlstr .="		queryData['".$v['field']."_end'] = $(\"#".$v['field']."_end\").val();\n";
					break;
					
					//地区三级联动搜索
					case 17:
						foreach(explode("|",$v['field']) as $m=>$n){
							$htmlstr .="		queryData['".$n."'] = $(\"#".$n."\").val();\n";
						}
					break;
					
					default:
						if($v['field'] == 'name'){
							$v['field'] = 'name_s';
						}
						$htmlstr .="		queryData['".$v['field']."'] = $(\"#".$v['field']."\").val();\n";	
				}
			}
			
		}
		$htmlstr .="		return queryData;\n";
		$htmlstr .="	}\n\n";
		
		//生成选择动作
		$htmlstr .="	CodeGoods.check = function () {\n";
		$htmlstr .="		var selected = $('#' + this.id).bootstrapTable('getSelections');\n";
		$htmlstr .="		if(selected.length == 0){\n";
		$htmlstr .="			Feng.info(\"请先选中表格中的某一记录！\");\n";
		$htmlstr .="			return false;\n";
		$htmlstr .="		}else{\n";
		if($select_type == 'checkbox'){
			$htmlstr .="			CodeGoods.seItem = selected;\n";
		}else{
			$htmlstr .="			CodeGoods.seItem = selected[0];\n";
		}
		$htmlstr .="			return true;\n";
		$htmlstr .="		}\n";
		$htmlstr .="	};\n\n";
		
		//生成动作
		foreach($scriptGroup as $k=>$v){
			if(in_array($v['type'],[10,11]) && $v['fields']){
				$htmlstr .= "	CodeGoods.".$v['action_name']." = function (value,".$v['fields'].") {\n";
			}else{
				$htmlstr .= "	CodeGoods.".$v['action_name']." = function (value) {\n";
			}
			
			switch($v['type']){
				//添加
				case 3:
					list($width,$height) = explode('|',$v['remark']);
					$htmlstr .= "		var url = location.search;\n";
					$htmlstr .= "		var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."'+url});\n";
					$htmlstr .= "		this.layerIndex = index;\n";
					$htmlstr .= "		if(!IsPC()){layer.full(index)}\n";
				break;
				
				//修改
				case 4:
					list($width,$height) = explode('|',$v['remark']);
					$htmlstr .= "		if(value){\n";
					$htmlstr .= "			var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+value});\n";
					$htmlstr .= "			if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "		}else{\n";
					$htmlstr .= "			if (this.check()) {\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "				var idx = '';\n";
						$htmlstr .= "				$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "					idx += ',' + this.".$menuInfo['pk_id'].";\n";
						$htmlstr .= "				});\n";
						$htmlstr .= "				idx = idx.substr(1);\n";
						$htmlstr .= "				if(idx.indexOf(\",\") !== -1){\n";
						$htmlstr .= "					Feng.info(\"请选择单条数据！\");\n";
						$htmlstr .= "					return false;\n";
						$htmlstr .= "				}\n";
					}else{
						$htmlstr .= "				var idx = this.seItem.".$menuInfo['pk_id'].";\n";
					}
					$htmlstr .= "				var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+idx});\n";
					$htmlstr .= "				this.layerIndex = index;\n";
					$htmlstr .= "				if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "			}\n";
					$htmlstr .= "		}\n";
				break;
				
				//删除
				case (in_array($v['type'],[5,6,31,33,34])):
					$htmlstr .= "		if(value){\n";
					$htmlstr .="			Feng.confirm(\"是否".$v['name']."选中项？\", function () {\n";
					$htmlstr .="				var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."\", function (data) {\n";
					$htmlstr .="					if ('00' === data.status) {\n";
					$htmlstr .="						Feng.success(data.msg);\n";
					$htmlstr .="						CodeGoods.table.refresh();\n";
					$htmlstr .="					} else {\n";
					$htmlstr .="						Feng.error(data.msg);\n";
					$htmlstr .="					}\n";
					$htmlstr .="				});\n";
					$htmlstr .="				ajax.set('".$menuInfo['pk_id']."', value);\n";
					$htmlstr .="				ajax.start();\n";
					$htmlstr .="			});\n";
					$htmlstr .= "		}else{\n";
					$htmlstr .= "			if (this.check()) {\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "				var idx = '';\n";
						$htmlstr .= "				$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "					idx += ',' + this.".$menuInfo['pk_id'].";\n";
						$htmlstr .= "				});\n";
						$htmlstr .= "				idx = idx.substr(1);\n";
					}else{
						$htmlstr .= "				var idx = this.seItem.".$menuInfo['pk_id'].";\n";
					}
					$htmlstr .="				Feng.confirm(\"是否".$v['name']."选中项？\", function () {\n";
					$htmlstr .="					var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."\", function (data) {\n";
					$htmlstr .="						if ('00' === data.status) {\n";
					$htmlstr .="							Feng.success(data.msg,1000);\n";
					$htmlstr .="							CodeGoods.table.refresh();\n";
					$htmlstr .="						} else {\n";
					$htmlstr .="							Feng.error(data.msg,1000);\n";
					$htmlstr .="						}\n";
					$htmlstr .="					});\n";
					$htmlstr .="					ajax.set('".$menuInfo['pk_id']."', idx);\n";
					$htmlstr .="					ajax.start();\n";
					$htmlstr .="				});\n";
					$htmlstr .="			}\n";
					$htmlstr .="		}\n";
				break;

				
				//数值加 数值减 修改密码
				case (in_array($v['type'],[7,8,9])):
					list($width,$height) = explode('|',$v['remark']);
					$htmlstr .= "		if(value){\n";
					$htmlstr .= "			var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+value});\n";
					$htmlstr .= "			this.layerIndex = index;\n";
					$htmlstr .= "			if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "		}else{\n";
					$htmlstr .= "			if (this.check()) {\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "				var idx = '';\n";
						$htmlstr .= "				$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "					idx += ',' + this.".$menuInfo['pk_id'].";\n";
						$htmlstr .= "				});\n";
						$htmlstr .= "				idx = idx.substr(1);\n";
					}else{
						$htmlstr .= "				var idx = this.seItem.".$menuInfo['pk_id'].";\n";
					}
					$htmlstr .= "				var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+idx});\n";
					$htmlstr .= "				this.layerIndex = index;\n";
					$htmlstr .= "				if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "			}\n";
					$htmlstr .= "		}\n";
				break;
				
				
				
				//跳转链接
				case 10:
					$htmlstr .= "		if(value){\n";
					$htmlstr .= "			var queryData = {};\n";
					$htmlstr .= "			queryData['".$menuInfo['pk_id']."'] = value;\n";
					foreach(explode(',',$v['fields']) as $m=>$n){
						if($n){
							$htmlstr .= "			queryData['".$n."'] = ".$n.";\n";
						}
					}
					$htmlstr .= "			location.href= Feng.ctxPath +'".$v['jump']."?'+Feng.parseParam(queryData);\n";
					$htmlstr .= "		}else{\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "			if (this.check()) {\n";
						$htmlstr .= "				var idx = '';\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "				var ".$n." = '';\n";
							}
						}
						$htmlstr .= "				$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "					idx += ',' + this.".$menuInfo['pk_id'].";\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "					".$n." += ',' + this.".$n.";\n";
							}
						}
						$htmlstr .= "				});\n";
						$htmlstr .= "				idx = idx.substr(1);\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "				".$n." = ".$n.".substr(1);\n";
							}
						}
						$htmlstr .= "				if(idx.indexOf(\",\") !== -1){\n";
						$htmlstr .= "					Feng.info(\"请选择单条数据！\");\n";
						$htmlstr .= "					return false;\n";
						$htmlstr .= "				}\n";
					}else{
						$htmlstr .= "				var idx = this.seItem.".$menuInfo['pk_id'].";\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "				var ".$n." = this.seItem.".$n.";\n";
							}
						}
					}
					$htmlstr .= "				var queryData = {};\n";
					$htmlstr .= "				queryData['".$menuInfo['pk_id']."'] = idx;\n";
					foreach(explode(',',$v['fields']) as $m=>$n){
						if($n){
							$htmlstr .= "				queryData['".$n."'] = ".$n.";\n";
						}
					}
					$htmlstr .= "				location.href= Feng.ctxPath +'".$v['jump']."?'+Feng.parseParam(queryData);\n";
					$htmlstr .= "			}\n";
					$htmlstr .= "		}\n";
				break;
				
				//弹窗链接
				case 11:
					list($width,$height) = explode('|',$v['remark']);
					$htmlstr .= "		if(value){\n";
					$htmlstr .= "			var queryData = {};\n";
					$htmlstr .= "			queryData['".$menuInfo['pk_id']."'] = value;\n";
					foreach(explode(',',$v['fields']) as $m=>$n){
						if($n){
							$htmlstr .= "			queryData['".$n."'] = ".$n.";\n";
						}
					}
					$htmlstr .= "			var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '".$v['jump']."?'+Feng.parseParam(queryData)});\n";
					$htmlstr .= "			this.layerIndex = index;\n";
					$htmlstr .= "			if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "		}else{\n";
					$htmlstr .= "			if (this.check()) {\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "				var idx = '';\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "				var ".$n." = '';\n";
							}
						}
						$htmlstr .= "				$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "					idx += ',' + this.".$menuInfo['pk_id'].";\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "					".$n." += ',' + this.".$n.";\n";
							}
						}
						$htmlstr .= "				});\n";
						$htmlstr .= "				idx = idx.substr(1);\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "				".$n." = ".$n.".substr(1);\n";
							}
						}
						$htmlstr .= "				if(idx.indexOf(\",\") !== -1){\n";
						$htmlstr .= "					Feng.info(\"请选择单条数据！\");\n";
						$htmlstr .= "					return false;\n";
						$htmlstr .= "				}\n";
					}else{
						$htmlstr .= "				var idx = this.seItem.".$menuInfo['pk_id'].";\n";
						foreach(explode(',',$v['fields']) as $m=>$n){
							if($n){
								$htmlstr .= "				var ".$n." = this.seItem.".$n.";\n";
							}
						}
					}
					$htmlstr .= "				var queryData = {};\n";
					$htmlstr .= "				queryData['".$menuInfo['pk_id']."'] = idx;\n";
					foreach(explode(',',$v['fields']) as $m=>$n){
						if($n){
							$htmlstr .= "				queryData['".$n."'] = ".$n.";\n";
						}
					}
					$htmlstr .= "				var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '".$v['jump']."?'+Feng.parseParam(queryData)});\n";
					$htmlstr .= "				this.layerIndex = index;\n";
					$htmlstr .= "				if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "			}\n";
					$htmlstr .= "		}\n";
				break;
				
				//导出数据
				case 12:
					$htmlstr .= "		var select_id = '';\n";
					$htmlstr .= "		if (this.check()){\n";
					$htmlstr .= "			$.each(CodeGoods.seItem, function() {\n";
					$htmlstr .= "				select_id += ',' + this.".$menuInfo['pk_id'].";\n";
					$htmlstr .= "			});\n";
					$htmlstr .= "		}\n";
					$htmlstr .= "		select_id = select_id.substr(1);\n";
					$htmlstr .= "		Feng.confirm(\"是否确定导出记录?\", function() {\n";
					$htmlstr .= "			var index = layer.msg('正在导出下载，请耐心等待...', {\n";
					$htmlstr .= "				time : 3600000,\n";
					$htmlstr .= "				icon : 16,\n";
					$htmlstr .= "				shade : 0.01\n";
					$htmlstr .= "			});\n";
					$htmlstr .= "			var idx =[];\n";
					$htmlstr .= "			$(\"li input:checked\").each(function(){\n";
					$htmlstr .= "				idx.push($(this).attr('data-field'));\n";
					$htmlstr .= "			});\n";
					$htmlstr .= "			var queryData = CodeGoods.formParams();\n";
					$htmlstr .= "			window.location.href = Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?action_id=".$menuInfo['menu_id']."&' + Feng.parseParam(queryData) + '&' +Feng.parseParam(idx) + '&".$menuInfo['pk_id']."=' + select_id;\n";
					$htmlstr .= "			setTimeout(function() {\n";
					$htmlstr .= "				layer.close(index)\n";
					$htmlstr .= "			}, 1000);\n";
					$htmlstr .= "		});\n";
				break;
				
				//导入数据
				case 13:
					$htmlstr .= "		var index = layer.open({type: 2,title: '".$v['name']."',area: ['500px', '300px'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."'});\n";
					$htmlstr .= "		this.layerIndex = index;\n";
					$htmlstr .= "		if(!IsPC()){layer.full(index)}\n";
				break;
				
				//批量修改数据
				case 14:
					list($width,$height) = explode('|',$v['remark']);
					$htmlstr .= "		if (this.check()) {\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "			var idx = '';\n";
						$htmlstr .= "			$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "				idx += ',' + this.".$menuInfo['pk_id'].";\n";
						$htmlstr .= "			});\n";
						$htmlstr .= "			idx = idx.substr(1);\n";
					}else{
						$htmlstr .= "			var idx = this.seItem.".$menuInfo['pk_id'].";\n";
					}
					$htmlstr .= "			var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+idx});\n";
					$htmlstr .= "			this.layerIndex = index;\n";
					$htmlstr .= "			if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "		}\n";
				break;
				
				//查看数据
				case 15:
					list($width,$height) = explode('|',$v['remark']);
					$htmlstr .= "		if(value){\n";
					$htmlstr .= "			var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+value});\n";
					$htmlstr .= "			if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "		}else{\n";
					$htmlstr .= "			if (this.check()) {\n";
					if($select_type == 'checkbox'){
						$htmlstr .= "				var idx = '';\n";
						$htmlstr .= "				$.each(CodeGoods.seItem, function() {\n";
						$htmlstr .= "					idx += ',' + this.".$menuInfo['pk_id'].";\n";
						$htmlstr .= "				});\n";
						$htmlstr .= "				idx = idx.substr(1);\n";
						$htmlstr .= "				if(idx.indexOf(\",\") !== -1){\n";
						$htmlstr .= "					Feng.info(\"请选择单条数据！\");\n";
						$htmlstr .= "					return false;\n";
						$htmlstr .= "				}\n";
					}else{
						$htmlstr .= "				var idx = this.seItem.".$menuInfo['pk_id'].";\n";
					}
					$htmlstr .= "				var index = layer.open({type: 2,title: '".$v['name']."',area: ['".$width."', '".$height."'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."?".$menuInfo['pk_id']."='+idx});\n";
					$htmlstr .= "				this.layerIndex = index;\n";
					$htmlstr .= "				if(!IsPC()){layer.full(index)}\n";
					$htmlstr .= "			}\n";
					$htmlstr .= "		}\n";
				break;
				
				//回收站
				case 32:
					$htmlstr .= "		var index = layer.open({type: 2,title: '".$v['name']."',area: ['95%', '95%'],fix: false, maxmin: true,content: Feng.ctxPath + '/".getUrlName($menuInfo['controller_name'])."/".$v['action_name']."'});\n";
					$htmlstr .= "		this.layerIndex = index;\n";
				break;
				
			}
			$htmlstr .= "	}\n\n\n";
		}
		
		
		//生成查询动作
		$htmlstr .="	CodeGoods.search = function() {\n";
		$htmlstr .="		CodeGoods.table.refresh({query : CodeGoods.formParams()});\n";
		$htmlstr .="	};\n\n";
		
		if($reset_button_status){
			//生成重置
			$htmlstr .="	CodeGoods.reset = function() {\n";
			$htmlstr .="		$(\"#searchGroup input,select\").val('');\n";
			$htmlstr .="		CodeGoods.table.refresh({query : CodeGoods.formParams()});\n";
			$htmlstr .="	};\n\n";
		}
		
		//获取列表显示数据条数
		$listWhere['menu_id'] = $menuInfo['menu_id'];
		$listWhere['type'] = 1;
		$fieldInfo = Action::where($listWhere)->find();
		$pagesize = !empty($fieldInfo['pagesize']) ? $fieldInfo['pagesize'] : 20;
		//生成初始化加载动作
		$htmlstr .="	$(function() {\n";
		$htmlstr .="		var defaultColunms = CodeGoods.initColumn();\n";
		$htmlstr .="		var url = location.search;\n";
		$htmlstr .="		var table = new BSTable(CodeGoods.id, Feng.ctxPath+\"/".getUrlName($menuInfo['controller_name'])."/".$actionInfo['action_name']."\"+url,defaultColunms,".$pagesize.");\n";
		$htmlstr .="		table.setPaginationType(\"server\");\n";
		$htmlstr .="		table.setQueryParams(CodeGoods.formParams());\n";
		$htmlstr .="		CodeGoods.table = table.init();\n";
		$htmlstr .="	});\n";
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['type'],[7,12]) && $val['search_show']){
				$dateList = \app\admin\controller\Sys\service\FieldSetService::dateList();
				$default_value = explode('|',$val['default_value']);
				$time_format = $dateList[$default_value[0]];
				if(!$time_format || $val['default_value'] == 'null'){
					$time_format = 'datetime';
				}
				$htmlstr .="	laydate.render({elem: '#".$val['field']."',type: '".$time_format."',range:true,\n";
				$htmlstr .="		ready: function(date){\n";
				$htmlstr .="			$(\".layui-laydate-footer [lay-type='datetime'].laydate-btns-time\").click();\n";
				$htmlstr .="			$(\".laydate-main-list-1 .layui-laydate-content li ol li:last-child\").click();\n";
				$htmlstr .="			$(\".layui-laydate-footer [lay-type='date'].laydate-btns-time\").click();\n";
				$htmlstr .="		}\n";
				$htmlstr .="	});\n";
			}
		}
		
		
		$htmlstr .="</script>\n";
		
		$htmlstr .="{/block}";
		
		$rootPath = app()->getRootPath();
		$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/view/'.getViewName($menuInfo['controller_name']).'/'.$actionInfo['action_name'].'.html';
		filePutContents($htmlstr,$filepath,$type=2);
	}
	
	/**
     * 生成添加、修改等模板html页面
     * @param array applicationInfo 应用信息
	 * @param array menuInfo 菜单信息
	 * @param array actionInfo 方法信息
     * @param array fieldList 字段列表
	 * @return str
     */
	public static function createInfoTpl($applicationInfo,$menuInfo,$actionInfo,$fieldList){
		//判断是否存在tab选项卡
		$tabList = FieldSetService::tabList($menuInfo['menu_id']); //tab菜单
		if($tabList){
			$htmlstr .=self::tabForm($fieldList,$actionInfo,$tabList,$menuInfo,$applicationInfo);  
		}else{
			$htmlstr .=self::normalForm($fieldList,$actionInfo,$menuInfo,$applicationInfo); 
		}
		
		$htmlstr .= "			<div class=\"hr-line-dashed\"></div>\n";
		$htmlstr .= "			<div class=\"row btn-group-m-t\">\n";
		$sizeArr = explode('|',$actionInfo['remark']);
		preg_match_all('/\d+/',$sizeArr[0],$res);
		$width = $res[0][0];
		$htmlstr .= "				<div class=\"col-sm-9 col-sm-offset-1\">\n";
		
		$htmlstr .= "					<button type=\"button\" class=\"btn btn-primary\" onclick=\"CodeInfoDlg.".$actionInfo['action_name']."()\" id=\"ensure\">\n";
		$htmlstr .= "						<i class=\"fa fa-check\"></i>&nbsp;确认提交\n";
		$htmlstr .= "					</button>\n";
		$htmlstr .= "					<button type=\"button\" class=\"btn btn-danger\" onclick=\"CodeInfoDlg.close()\" id=\"cancel\">\n";
		$htmlstr .= "						<i class=\"fa fa-eraser\"></i>&nbsp;取消\n";
		$htmlstr .= "					</button>\n";
		$htmlstr .= "				</div>\n";
		$htmlstr .= "			</div>\n";
		$htmlstr .= "		</div>\n";
		$htmlstr .= "	</div>\n";
		$htmlstr .= "</div>\n";
		
		$htmlstr .= "<script src=\"__PUBLIC__/static/js/upload.js\" charset=\"utf-8\"></script>\n";
		$htmlstr .= "<script src=\"__PUBLIC__/static/js/plugins/layui/layui.js\" charset=\"utf-8\"></script>\n";
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['type'],[27,29]) && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$chosen_status = true;
			}
			
			if($val['type'] == 28 && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$tag_status = true;
			}
			
			if($val['type'] == 9 && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$images_status = true; //多图
			}
			
			if($val['type'] == 32 && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$jzd = true; //键值对
			}
		}
		if($chosen_status){
			$htmlstr .= "<link href='__PUBLIC__/static/js/plugins/chosen/chosen.min.css' rel='stylesheet'/>\n";
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/chosen/chosen.jquery.js'></script>\n";
		}
		if($tag_status){
			$htmlstr .= "<link rel='stylesheet' href='__PUBLIC__/static/js/plugins/tagsinput/tagsinput.css'>\n";
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/tagsinput/tagsinput.min.js'></script>\n";
		}
		
		if($images_status || $jzd){
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/paixu/jquery-migrate-1.1.1.js'></script>\n";
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/paixu/jquery.dragsort-0.5.1.min.js'></script>\n";
		}
		
		$htmlstr .= "<script>\n";
		if($images_status || $jzd){
			$htmlstr.="\$(function(){\n";
			foreach($fieldList as $key=>$val){
				if($val['type'] == 32 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					$htmlstr .="	$(\".".$val['field']."\").dragsort({dragSelector: \".move\",dragBetween: true ,dragEnd:function(){}});\n";
				}
				if($val['type'] == 9 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					$htmlstr .="	$(\".filelist\").dragsort({dragSelector: \"img\",dragBetween: true ,dragEnd:function(){}});\n";
				}
			}
			$htmlstr.="});\n";
		}
		$htmlstr .= "layui.use(['form'],function(){});\n";
		if($tabList){
		$htmlstr .= "layui.use('element', function(){\n";
		$htmlstr .= "	var element = layui.element;\n";
		$htmlstr .= "	element.on('tab(test)', function(elem){\n";
		$firstMenuName = $tabList[0];
		unset($tabList[0]);
		foreach($fieldList as $key=>$val){
			if($val['type'] == 8 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList) && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "		uploader('".$val['field']."_upload','".$val['field']."','image',false,'','{:getUploadServerUrl()}');\n";
			}
			
			if($val['type'] == 10 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList) && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "		uploader('".$val['field']."_upload','".$val['field']."','file',false,'','{:getUploadServerUrl()}');\n";
			}
			
			if($val['type'] == 27 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList) && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "		$(\".chosen-container\").css('width','100%');\n";
			}
			
			if($val['type'] == 29 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList) && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "		$(\".chosen-container\").css('width','100%');\n";
			}
			
			if($val['type'] == 34 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList) && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "		uploader('".$val['field']."_upload','".$val['field']."','file',true,'','{:getUploadServerUrl()}');\n";
			}
		}
		$htmlstr .= "	});\n";
		
		$htmlstr .= "});\n";
		}
		
		if($fieldList){
			foreach($fieldList as $key=>$val){
				if($val['type'] == 8 && $val['is_post'] == 1 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					if($menuInfo['upload_config_id']){
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',false,'','{:getUploadServerUrl(".$menuInfo['upload_config_id'].")}');\n";
					}else{
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',false,'','{:getUploadServerUrl()}');\n";
					}
				}
				if($val['type'] == 9 && $val['is_post'] == 1 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					if($menuInfo['upload_config_id']){
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',true,'{\$info.".$val['field']."}','{:getUploadServerUrl(".$menuInfo['upload_config_id'].")}');\n";
					}else{
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',true,'{\$info.".$val['field']."}','{:getUploadServerUrl()}');\n";
					}
					
					$htmlstr .= "setUploadButton('".$val['field']."_upload');\n";
				}
				if($val['type'] == 10 && $val['is_post'] == 1 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','file',false,'','{:getUploadServerUrl()}');\n";
				}
				if($val['type'] == 34 && $val['is_post'] == 1 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','file',true,'{\$info.".$val['field']."}','{:getUploadServerUrl()}');\n";
				}
			}	
		}
		if($chosen_status){
			$htmlstr .="\$(function(){\$('.chosen').chosen({search_contains: true})})\n";
		}
		foreach($fieldList as $key=>$val){
			if(in_array($val['type'],[7,12,25,31]) && $val['is_post'] && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$dateList = \app\admin\controller\Sys\service\FieldSetService::dateList();
				$default_value = explode('|',$val['default_value']);
				$time_format = $dateList[$default_value[0]];
				if(!$time_format || $val['default_value'] == 'null'){
					$time_format = 'datetime';
				}
				if($val['type'] == 31){
					$htmlstr .="laydate.render({elem: '#".$val['field']."',type: '".$time_format."',range:true,trigger:'click'});\n";
				}else{
					$htmlstr .="laydate.render({elem: '#".$val['field']."',type: '".$time_format."',trigger:'click'});\n";
				}
				
			}
		}
		
		$htmlstr .= "var CodeInfoDlg = {\n";
		$htmlstr .= "	CodeInfoData: {},\n";
		$htmlstr .= "	validateFields: {\n";
		
		
		foreach($fieldList as $key=>$val){
			$val = checkData($val);
			if((!empty($val['validate']) || !empty($val['rule'])) && $val['type'] != 17 && in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "		".$val['field'].": {\n";
				$htmlstr .= "			validators: {\n";
				if(in_array('notEmpty',explode(',',$val['validate']))){
					$htmlstr .= "				notEmpty: {\n";
					$htmlstr .= "					message: '".$val['name']."不能为空'\n";
					$htmlstr .= "	 			},\n";
				}
				
				if(!empty($val['rule'])){
					$htmlstr .= "				regexp: {\n";
					$htmlstr .= "					regexp: ".$val['rule'].",\n";
					$htmlstr .= "					message: '".$val['message']."'\n";
					$htmlstr .= "	 			},\n";
				}
				
				$htmlstr .= "	 		}\n";
				$htmlstr .= "	 	},\n";
			}	
		}	
		
		
		$htmlstr .= "	 }\n";
		$htmlstr .= "}\n\n";
		
		$htmlstr .= "CodeInfoDlg.collectData = function () {\n";
		$htmlstr .="	this";
		
		$htmlstr .= ".set('".$menuInfo['pk_id']."')";
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['field'],explode(',',$actionInfo['fields']))){
				if(!in_array($val['type'],[3,4,9,16,17,23,32,33,34])){
					$htmlstr .= ".set('".$val['field']."')";   //去掉单选框 复选框 因为这两个是不能用唯一ID的  去掉百度编辑器 三级联动
				}
				//三级联动
				if($val['type'] == 17 && !empty($val['field'])){
					foreach(explode('|',$val['field']) as $k=>$v){
						$htmlstr .= ".set('".$v."')";
					}
				}
			}
		}
		
		$htmlstr .= ";\n";
		$htmlstr .= "};\n\n";
		
		if(in_array($actionInfo['type'],[3,4,14])){
			$htmlstr .= "CodeInfoDlg.".$actionInfo['action_name']." = function () {\n";
			$htmlstr .= "	 this.clearData();\n";
			$htmlstr .= "	 this.collectData();\n";
			$htmlstr .= "	 if (!this.validate()) {\n";
			$htmlstr .= "	 	return;\n";
			$htmlstr .= "	 }\n";
			
			foreach($fieldList as $k=>$v){
				if(in_array($v['field'],explode(',',$actionInfo['fields']))){
					if($v['type'] == 3 || $v['type'] == 23){
						$htmlstr .= "	 var ".$v['field']." = $(\"input[name = '".$v['field']."']:checked\").val();\n";
					}
					
					if($v['type'] == 4){
						$htmlstr .= "	 var ".$v['field']." = '';\n";
						$htmlstr .= "	 $('input[name=\"".$v['field']."\"]:checked').each(function(){ \n";
						$htmlstr .= "	 	".$v['field']." += ',' + $(this).val(); \n";
						$htmlstr .= "	 }); \n";
						$htmlstr .= "	  ".$v['field']." = ".$v['field'].".substr(1); \n";
					}
					
					if($v['type'] == 9){
						$htmlstr .= "	 var ".$v['field']." = {};\n";
						$htmlstr .= "	 $(\".".$v['field']." li\").each(function() {\n";
						$htmlstr .="		if($(this).find('img').attr('src')){\n";
						$htmlstr .= "	 		".$v['field']."[\$(this).index()] = {'url':$(this).find('img').attr('src'),'title':$(this).find('input').val()};\n";
						$htmlstr .="		}\n";
						$htmlstr .= "	 });\n";
					}
					
					if($v['type'] == 16){
						$htmlstr .= "	 var ".$v['field']." = UE.getEditor('".$v['field']."').getContent();\n";
					}
					
					if($v['type'] == 32){
						$htmlstr .= "	 var ".$v['field']." = {};\n";
						$htmlstr .= "	 var ".$v['field']."input = $('.".$v['field']."-line');\n";
						$htmlstr .= "	 for (var i = 0; i < ".$v['field']."input.length; i++) {\n";
						$htmlstr .= "		if(".$v['field']."input.eq(i).find('input').eq(0).val() !== ''){\n";
						$htmlstr .= "	 		".$v['field']."[".$v['field']."input.eq(i).find('input').eq(0).val()] = ".$v['field']."input.eq(i).find('input').eq(1).val();\n";
						$htmlstr .="		}\n";
						$htmlstr .= "	 };\n";
					}
					
					if($v['type'] == 34){
						$htmlstr .= "	 var ".$v['field']." = [];\n";
						$htmlstr .= "	 $(\".".$v['field']." i\").each(function() {\n";
						$htmlstr .="		".$v['field'].".push($(this).text());\n";
						$htmlstr .= "	 });\n";
					}
				}
			}
							
			$htmlstr .= "	 var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/".$actionInfo['action_name']."\", function (data) {\n";
			$htmlstr .= "	 	if ('00' === data.status) {\n";
			$htmlstr .= "	 		Feng.success(data.msg,1000);\n";
			if($menuInfo['menu_id'] <> config('my.config_module_id')){
				$htmlstr .= "	 		window.parent.CodeGoods.table.refresh();\n";
			}
			$htmlstr .= "	 		CodeInfoDlg.close();\n";
			$htmlstr .= "	 	} else {\n";
			$htmlstr .= "	 		Feng.error(data.msg + \"！\",1000);\n";
			$htmlstr .= "		 }\n";
			$htmlstr .= "	 })\n";
			if($fieldList){
				foreach($fieldList as $k=>$v){
					if(in_array($v['field'],explode(',',$actionInfo['fields'].$relateFields))){
						if(in_array($v['type'],[3,4,16,23])){
							$htmlstr .= "	 ajax.set('".$v['field']."',".$v['field'].");\n";
						}
						if(in_array($v['type'],[9,32])){
							$htmlstr .= "	 ajax.set('".$v['field']."',(JSON.stringify(".$v['field'].") == '{}' || JSON.stringify(".$v['field'].") == '{\"\":\"\"}') ? '' : JSON.stringify(".$v['field']."));\n";
						}
						if($v['type'] == 33){
							$htmlstr .= "	 ajax.set('".$v['field']."',".$v['field'].".getMarkdown());\n";
						}
						if($v['type'] == 34){
							$htmlstr .= "	 ajax.set('".$v['field']."',".$v['field'].".join(\"|\"));\n";
						}
					}
				}
			}
			
			//查询是否存在关联表
			if($val['relate_table'] && $val['relate_field']){
				$relateTableFieldList = BuildService::getRelateFieldList($val['relate_table']);
				if($relateTableFieldList){
					foreach($relateTableFieldList as $k=>$v){
						if($v['type'] == 3 || $v['type'] == 23){
							$htmlstr .= "	 var ".$v['field']." = $(\"input[name = '".$v['field']."']:checked\").val();\n";
						}elseif($v['type'] == 4){
							$htmlstr .= "	 var ".$v['field']." = '';\n";
							$htmlstr .= "	 $('input[name=\"".$v['field']."\"]:checked').each(function(){ \n";
							$htmlstr .= "	 	".$v['field']." += ',' + $(this).val(); \n";
							$htmlstr .= "	 }); \n";
							$htmlstr .= "	  ".$v['field']." = ".$v['field'].".substr(1); \n";
						}elseif($v['type'] == 9){
							$htmlstr .= "	 var ".$v['field']." = '';\n";
							$htmlstr .= "	 $(\".".$v['field']." img\").each(function() {\n";
							$htmlstr .= "	 	".$v['field']." += '|'+$(this).attr('src');\n";
							$htmlstr .= "	 });\n";
							$htmlstr .= "	 ".$v['field']." = ".$v['field'].".substr(1);\n";
						}elseif($v['type'] == 16){
							$htmlstr .= "	 var ".$v['field']." = UE.getEditor('".$v['field']."').getContent();\n";
						}else{
							$htmlstr .= "	 var ".$v['field']." = $('#".$v['field']."').val();\n";
						}
					}
					
					foreach($relateTableFieldList as $k=>$v){
						$htmlstr .= "	 ajax.set('".$v['field']."',".$v['field'].");\n";
					}
				}
			}
			
			$htmlstr .= "	 ajax.set(this.CodeInfoData);\n";
			$htmlstr .= "	 ajax.start();\n";
			$htmlstr .= "};\n\n\n";
		}
		
		//数据累加 递减
		if($actionInfo['type'] == 7 || $actionInfo['type'] == 8){
			$htmlstr .= "CodeInfoDlg.".$actionInfo['action_name']." = function () {\n";
			$htmlstr .= "	 this.clearData();\n";
			$htmlstr .= "	 this.collectData();\n";
			$htmlstr .= "	 if (!this.validate()) {\n";
			$htmlstr .= "	 	return;\n";
			$htmlstr .= "	 }\n";
			
			$htmlstr .= "	 var tip = '操作';\n";				
			$htmlstr .= "	 var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/".$actionInfo['action_name']."\", function (data) {\n";
			$htmlstr .= "	 	if ('00' === data.status) {\n";
			$htmlstr .= "	 		Feng.success(tip + \"成功\" );\n";
			$htmlstr .= "	 		window.parent.CodeGoods.table.refresh();\n";
			$htmlstr .= "	 		CodeInfoDlg.close();\n";
			$htmlstr .= "	 	} else {\n";
			$htmlstr .= "	 		Feng.error(data.msg + \"！\",1000);\n";
			$htmlstr .= "		 }\n";
			$htmlstr .= "	 }, function (data) {\n";
			$htmlstr .= "	 	Feng.error(\"操作失败!\" + data.responseJSON.message + \"!\");\n";
			$htmlstr .= "	 });\n";
			$htmlstr .= "	 ajax.set(this.CodeInfoData);\n";
			$htmlstr .= "	 ajax.start();\n";
			$htmlstr .= "};\n\n\n";
		}
		
		//修改密码
		if($actionInfo['type'] == 9){
			$htmlstr .= "CodeInfoDlg.".$actionInfo['action_name']." = function () {\n";
			$htmlstr .= "	 this.clearData();\n";
			$htmlstr .= "	 this.collectData();\n";
			$htmlstr .= "	 if (!this.validate()) {\n";
			$htmlstr .= "	 	return;\n";
			$htmlstr .= "	 }\n";
			
			$htmlstr .= "	 var tip = '操作';\n";				
			$htmlstr .= "	 var ajax = new \$ax(Feng.ctxPath + \"/".getUrlName($menuInfo['controller_name'])."/".$actionInfo['action_name']."\", function (data) {\n";
			$htmlstr .= "	 	if ('00' === data.status) {\n";
			$htmlstr .= "	 		Feng.success(tip + \"成功\" );\n";
			$htmlstr .= "	 		window.parent.CodeGoods.table.refresh();\n";
			$htmlstr .= "	 		CodeInfoDlg.close();\n";
			$htmlstr .= "	 	} else {\n";
			$htmlstr .= "	 		Feng.error(data.msg + \"！\",1000);\n";
			$htmlstr .= "		 }\n";
			$htmlstr .= "	 }, function (data) {\n";
			$htmlstr .= "	 	Feng.error(\"操作失败!\" + data.responseJSON.message + \"!\");\n";
			$htmlstr .= "	 });\n";
			$htmlstr .= "	 ajax.set(this.CodeInfoData);\n";
			$htmlstr .= "	 ajax.start();\n";
			$htmlstr .= "};\n\n\n";
		}	
		
		$htmlstr .= "</script>\n";
		$htmlstr .= "<script src=\"__PUBLIC__/static/js/base.js\" charset=\"utf-8\"></script>\n";
		$htmlstr .= "{/block}\n";
		
		$rootPath = app()->getRootPath();
		$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/view/'.getViewName($menuInfo['controller_name']).'/'.$actionInfo['action_name'].'.html';
		filePutContents($htmlstr,$filepath,$type=2);
	}
	
	//普通表单模式
	public static function normalForm($fieldList,$actionInfo,$menuInfo,$applicationInfo){
		$htmlstr = '';
		$htmlstr .= "{extend name='common/_container'}\n";
		$htmlstr .= "{block name=\"content\"}\n";
		$htmlstr .= "<div class=\"ibox float-e-margins\">\n";
		if($actionInfo['type'] <> 3){
		$htmlstr .= "<input type=\"hidden\" name='".$menuInfo['pk_id']."' id='".$menuInfo['pk_id']."' value=\"{\$info.".$menuInfo['pk_id']."}\" />\n";
		}
		$htmlstr .= "	<div class=\"ibox-content\">\n";
		$htmlstr .= "		<div class=\"form-horizontal\" id=\"CodeInfoForm\">\n";
		$htmlstr .= "			<div class=\"row\">\n";
		$htmlstr .= "				<div class=\"col-sm-12\">\n";
		$htmlstr .= "				<!-- form start -->\n";
		if($fieldList){
			foreach($fieldList as $key=>$val){
				if($val['is_post'] == 1 && in_array($val['field'],explode(',',$actionInfo['fields']))){
					$htmlstr .= 					BuildService::formGroup($val,$actionInfo['type'],$applicationInfo,$menuInfo);
				}	
			}
		}
		
		$htmlstr .= "				<!-- form end -->\n";	
		$htmlstr .= "				</div>\n";
		$htmlstr .= "			</div>\n";

		
		return $htmlstr;
	}
	
	public static function tabForm($fieldlist,$actionInfo,$tabList,$menuInfo,$applicationInfo){

		$htmlstr = '';
		$htmlstr .= "{extend name='common/_container'}\n";
		$htmlstr .= "{block name=\"content\"}\n";
		$htmlstr .= "<div class=\"ibox float-e-margins\">\n";
		if($actionInfo['type'] <> 3){
		$htmlstr .= "<input type=\"hidden\" name='".$menuInfo['pk_id']."' id='".$menuInfo['pk_id']."' value=\"{\$info.".$menuInfo['pk_id']."}\" />\n";
		}
		$htmlstr .= "	<div class=\"ibox-content\">\n";
		$htmlstr .= "		<div class=\"form-horizontal\" id=\"CodeInfoForm\">\n";
		$htmlstr .= "			<div class=\"row\" style=\"margin-top:-20px;\">\n";
		$htmlstr .= "				<div class=\"layui-tab layui-tab-brief\" lay-filter=\"test\">\n";
		if($tabList){
			$htmlstr .= "					<ul class=\"layui-tab-title\">\n";
			foreach($tabList as $key=>$val){
				if($key == 0){
					$htmlstr .= "						<li class=\"layui-this\">".$val."</li>\n";
				}else{
					$htmlstr .= "						<li>".$val."</li>\n";
				}
				
			}
			$htmlstr .= "					</ul>\n";
		}
		$htmlstr .= "					<div class=\"layui-tab-content\" style=\"margin-top:10px;\">\n";
		if($tabList){
			foreach($tabList as $k=>$v){
				if($k == 0){
					$htmlstr .= "						<div class=\"layui-tab-item layui-show\">\n";
				}else{
					$htmlstr .= "						<div class=\"layui-tab-item\">\n";
				}
				
				$htmlstr .= "							<div class=\"col-sm-12\">\n";
				$htmlstr .= "							<!-- form start -->\n";
				if($fieldlist){
					foreach($fieldlist as $key=>$val){
						if($val['is_post'] == 1 && $val['tab_menu_name'] == $v && in_array($val['field'],explode(',',$actionInfo['fields']))){
							$htmlstr .= 	BuildService::formGroup($val,$actionInfo['type'],$applicationInfo,$menuInfo);
						}	
					}
				}
				$htmlstr .= "							<!-- form end -->\n";
				$htmlstr .= "							</div>\n";
				$htmlstr .= "						</div>\n";
			}
		}
		$htmlstr .= "					</div>\n";
		$htmlstr .= "				</div>\n";
		$htmlstr .= "			</div>\n";
		
		return $htmlstr;
	}
	
	/**
     * 生成查看数据模板html页面
     * @param array applicationInfo 应用信息
	 * @param array menuInfo 菜单信息
	 * @param array actionInfo 方法信息
     * @param array fieldList 字段信息
	 * @return str
     */
	public static function createViewTpl($applicationInfo,$menuInfo,$actionInfo,$fieldList){
		$htmlstr .= "{extend name='common/_container'} \n";	
		$htmlstr .= "{block name=\"content\"} \n";
		$htmlstr .= "<div class=\"ibox float-e-margins\"> \n";
		$htmlstr .= "	<div class=\"ibox-content\"> \n";
		$htmlstr .= "		<table class=\"table table-bordered\" style=\"word-break:break-all;\"> \n";
		$htmlstr .= "			<tbody> \n";
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['field'],explode(',',$actionInfo['fields']))){
				$htmlstr .= "				<tr> \n";
				$htmlstr .= "					<td style=\"background-color:#F5F5F6; font-weight:bold; text-align:right\" width=\"15%\">".$val['name']."：</td> \n";
				
				$default_time_format = explode('|',$val['default_value']);
				$time_format = $default_time_format[0];
				if(!$time_format || $val['default_value'] == 'null'){
					$time_format = 'Y-m-d H:i:s';
				}
				
				switch($val['type']){				
					
					//下拉框
					case 2:
						if(empty($val['sql'])){
							$fieldval = '<?php echo getFieldVal($info["'.$val['field'].'"],"'.$val['config'].'");?>';
						}else{
							$fieldval = "{\$info.".$val['field']."}";
						}
					break;
					
					//单选框
					case 3:
						if(empty($val['sql'])){
							$fieldval = '<?php echo getFieldVal($info["'.$val['field'].'"],"'.$val['config'].'");?>';
						}else{
							$fieldval = "{\$info.".$val['field']."}";
						}
					break;
					
					//多选框
					case 4:
						if(empty($val['sql'])){
							$fieldval = '<?php echo getFieldVal($info["'.$val['field'].'"],"'.$val['config'].'");?>';
						}else{
							$fieldval = "{\$info.".$val['field']."}";
						}
					break;
					
					//开关按钮
					case 23:
						$fieldval = '<?php echo getFieldVal($info["'.$val['field'].'"],"'.$val['config'].'");?>';
					break;
					
					
					case 7:
						
						$fieldval = "{if \$info.".$val['field']."}{\$info.".$val['field']."|date='".$time_format."'}{/if}";
					break;
					
					case 8:
						$fieldval = '<a href="javascript:void(0)"  onclick="openImg(\'{$info.'.$val['field'].'}\')"><img height="75" src="{$info.'.$val['field'].'}"></a>';
					break;
					
					case 9:
						$fieldval = "\n";
						$fieldval .= "						<ul>\n";
						$fieldval .= "						<?php \$".$val['field']."List = json_decode(html_out(\$info[\"".$val['field']."\"]),true);?>\n";
						$fieldval .= "						{foreach name=\"".$val['field']."List\" id=\"vo\"}\n";
						$fieldval .= "						<li style=\"float:left; margin-bottom:2px; margin-right:2px;\"><a href=\"javascript:void(0)\" onclick=\"openImg('{\$vo.url}')\"><img src=\"{\$vo.url}\" height=\"75\"></a></li>\n";
						$fieldval .= "						{/foreach}\n";
						$fieldval .= "						</ul>\n";
					break;
					
					case 10:
						$fieldval = '<a target="_blank" href="{$info.'.$val['field'].'}">下载附件</a>';
					break;
					
					case 11:
						$fieldval = "{\$info.".$val['field']."|html_out}";
					break;
					
					case 12:
						$fieldval = "{if \$info.".$val['field']."}{\$info.".$val['field']."|date='".$time_format."'}{/if}";
					break;
					
					case 16:
						$fieldval = "{\$info.".$val['field']."|html_out}";
					break;
					
					case 17:
						$areaval = '';
						foreach(explode('|',$val['field']) as $m=>$n){
							$areaval .="{\$info.".$n."}"."-";
						}
						$fieldval = rtrim($areaval,'-');
					break;
					
					case 25:
						$fieldval = "{if \$info.".$val['field']."}{\$info.".$val['field']."|date='".$time_format."'}{/if}";
					break;
					
					case 27:
						if(empty($val['sql'])){
							$fieldval = '<?php echo getFieldVal($info["'.$val['field'].'"],"'.$val['config'].'");?>';
						}else{
							$fieldval = "{\$info.".$val['field']."}";
						}
					break;
					
					//下拉框搜索
					case 29:
						if(empty($val['sql'])){
							$fieldval = '<?php echo getFieldVal($info["'.$val['field'].'"],"'.$val['config'].'");?>';
						}else{
							$fieldval = "{\$info.".$val['field']."}";
						}
					break;
					
					case 34:
						$fieldval = "\n";
						$fieldval .= "						<?php \$".$val['field']."List = explode('|',\$info['".$val['field']."']);?>\n";
						$fieldval .= "						{foreach name=\"".$val['field']."List\" id=\"vo\"}\n";
						$fieldval .= "						<a href=\"{\$vo}\" >附件下载{\$key+1}</a>&nbsp;&nbsp;\n";
						$fieldval .= "						{/foreach}\n";
					break;
					
					default:
						$fieldval = "{\$info.".$val['field']."}";
				}
				$htmlstr .= "					<td>".$fieldval."</td>   \n";
				$htmlstr .= "				</tr> \n";
			}
		}
		$htmlstr .= "			</tbody> \n";
		$htmlstr .= "		</table> \n";
		$htmlstr .= "	</div> \n";
		$htmlstr .= "</div> \n";
		$htmlstr .= "{/block} \n";
		
		$rootPath = app()->getRootPath();
		$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/view/'.getViewName($menuInfo['controller_name']).'/'.$actionInfo['action_name'].'.html';
		filePutContents($htmlstr,$filepath,$type=2);
	}
	
	/**
     * 生成配置视图文件
     * @param array applicationInfo 应用信息
	 * @param array menuInfo 菜单信息
	 * @param array actionInfo 方法信息
     * @param array fieldList 字段列表
	 * @return str
     */
    public static function createConfig($applicationInfo,$menuInfo){
		
		$tabList = FieldSetService::tabList($menuInfo['menu_id']);
		$fieldList = Field::where(['menu_id'=>config('my.config_module_id'),'is_post'=>1])->order('sortid asc')->select();
		
		$htmlstr = '';
		$htmlstr .= "{extend name='common/_container'}\n";
		$htmlstr .= "{block name=\"content\"}\n";
		$htmlstr .= "<div class=\"ibox float-e-margins\">\n";
		$htmlstr .= "	<div class=\"ibox-content\">\n";
		$htmlstr .= "		<div class=\"form-horizontal\" id=\"CodeInfoForm\">\n";
		$htmlstr .= "			<div class=\"row\">\n";
		$htmlstr .= "				<div class=\"layui-tab layui-tab-brief\" lay-filter=\"test\">\n";
		if($tabList){
			$htmlstr .= "					<ul class=\"layui-tab-title\">\n";
			foreach($tabList as $key=>$val){
				if($key == 0){
					$htmlstr .= "						<li class=\"layui-this\">".$val."</li>\n";
				}else{
					$htmlstr .= "						<li>".$val."</li>\n";
				}
				
			}
			$htmlstr .= "					</ul>\n";
		}else{
			$htmlstr .= "					<ul class=\"layui-tab-title\">\n";
			$htmlstr .= "						<li class=\"layui-this\">系统配置</li>\n";
			$htmlstr .= "					</ul>\n";
		}
		$htmlstr .= "					<div class=\"layui-tab-content\" style=\"margin-top:10px;\">\n";
		if($tabList){
			foreach($tabList as $k=>$v){
				if($k == 0){
					$htmlstr .= "						<div class=\"layui-tab-item layui-show\">\n";
				}else{
					$htmlstr .= "						<div class=\"layui-tab-item\">\n";
				}
				$htmlstr .= "							<div class=\"col-sm-10\">\n";
				$htmlstr .= "							<!-- form start -->\n";
				if($fieldList){
					foreach($fieldList as $key=>$val){
						if($val['is_post'] == 1 && $val['tab_menu_name'] == $v){
							$htmlstr .= 	BuildService::formGroup($val,4,$applicationInfo,$menuInfo);
						}	
					}
				}
				$htmlstr .= "							<!-- form end -->\n";
				$htmlstr .= "							</div>\n";
				$htmlstr .= "						</div>\n";
			}
		}else{
				$htmlstr .= "						<div class=\"layui-tab-item layui-show\">\n";
				$htmlstr .= "							<div class=\"col-sm-10\">\n";
				$htmlstr .= "							<!-- form start -->\n";
				if($fieldList){
					foreach($fieldList as $key=>$val){
						if($val['is_post'] == 1){
							$htmlstr .= 	BuildService::formGroup($val,4,$applicationInfo,$menuInfo);
						}	
					}
				}
				$htmlstr .= "							<!-- form end -->\n";
				$htmlstr .= "							</div>\n";
				$htmlstr .= "						</div>\n";
		}
		$htmlstr .= "					</div>\n";
		$htmlstr .= "				</div>\n";
		$htmlstr .= "			</div>\n";
		$htmlstr .= "			<div class=\"hr-line-dashed\"></div>\n";
		$htmlstr .= "			<div class=\"row btn-group-m-t\">\n";
		$htmlstr .= "				<div class=\"col-sm-10\">\n";
		$htmlstr .= "					<button type=\"button\" class=\"btn btn-primary\" onclick=\"CodeInfoDlg.index()\" id=\"ensure\">\n";
		$htmlstr .= "						<i class=\"fa fa-check\"></i>&nbsp;确认提交\n";
		$htmlstr .= "					</button>\n";
		$htmlstr .= "					<button type=\"button\" class=\"btn btn-danger\" onclick=\"CodeInfoDlg.close()\" id=\"cancel\">\n";
		$htmlstr .= "						<i class=\"fa fa-eraser\"></i>&nbsp;取消\n";
		$htmlstr .= "					</button>\n";
		$htmlstr .= "				</div>\n";
		$htmlstr .= "			</div>\n";
		$htmlstr .= "		</div>\n";
		$htmlstr .= "	</div>\n";
		$htmlstr .= "</div>\n";

		$htmlstr .= "<script src=\"__PUBLIC__/static/js/upload.js\" charset=\"utf-8\"></script>\n";
		$htmlstr .= "<script src=\"__PUBLIC__/static/js/plugins/layui/layui.js?t=1498856285724\" charset=\"utf-8\"></script>\n";
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['type'],[27,29])){
				$chosen_status = true;
			}
			
			if($val['type'] == 28){
				$tag_status = true;
			}
			
			if($val['type'] == 9){
				$images_status = true; //多图
			}
		}
		if($chosen_status){
			$htmlstr .= "<link href='__PUBLIC__/static/js/plugins/chosen/chosen.min.css' rel='stylesheet'/>\n";
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/chosen/chosen.jquery.js'></script>\n";
		}
		if($tag_status){
			$htmlstr .= "<link rel='stylesheet' href='__PUBLIC__/static/js/plugins/tagsinput/tagsinput.css'>\n";
			$htmlstr .= "<script type='text/javascript' src='__PUBLIC__/static/js/plugins/tagsinput/tagsinput.min.js'></script>\n";
		}
		
		if($images_status){
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/paixu/jquery-migrate-1.1.1.js'></script>\n";
			$htmlstr .= "<script src='__PUBLIC__/static/js/plugins/paixu/jquery.dragsort-0.5.1.min.js'></script>\n";
		}
		
		$htmlstr .= "<script>\n";
		if($images_status){
			$htmlstr.="\$(function(){\n";
			$htmlstr .="	$(\".filelist\").dragsort({dragSelector: \"img\",dragBetween: true ,dragEnd:function(){}});\n";
			foreach($fieldList as $key=>$val){
				if($val['type'] == 32){
					$htmlstr .="	$(\".".$val['field']."\").dragsort({dragSelector: \".move\",dragBetween: true ,dragEnd:function(){}});\n";
				}
			}
			$htmlstr.="});\n";
		}
		$htmlstr .= "layui.use(['form'],function(){});\n";
		$htmlstr .= "layui.use('element', function(){\n";
		$htmlstr .= "	var element = layui.element;\n";
		$htmlstr .= "	element.on('tab(test)', function(elem){\n";
		
		/*
		*此处比较特别需要注意
		layer第二个选项卡以后都不能直接渲染上传按钮效果 所以必须切换的时候再进行渲染
		*/
		
		$firstMenuName = $tabList[0];
		unset($tabList[0]);
		foreach($fieldList as $key=>$val){
			if($val['type'] == 8 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList)){
				$htmlstr .= "		uploader('".$val['field']."_upload','".$val['field']."','image',false,'','{:url(\"".$applicationInfo['app_dir'].'/Upload/uploadImages'."\")}');\n";
			}
			if($val['type'] == 10 && $val['is_post'] == 1 && in_array($val['tab_menu_name'],$tabList)){
				$htmlstr .= "		uploader('".$val['field']."_upload','".$val['field']."','file',false,'','{:url(\"".$applicationInfo['app_dir'].'/Upload/uploadImages'."\")}');\n";
			}
		}
		$htmlstr .= "	});\n";
		
		$htmlstr .= "});\n";
		
		if($fieldList){
			foreach($fieldList as $key=>$val){
				if($val['type'] == 8 && $val['is_post'] == 1){
					if($menuInfo['upload_config_id']){
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',false,'','{:getUploadServerUrl(".$menuInfo['upload_config_id']."])}');\n";
					}else{
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',false,'','{:getUploadServerUrl()}');\n";
					}
				}
				if($val['type'] == 9 && $val['is_post'] == 1){
					if($menuInfo['upload_config_id']){
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',true,'{\$info.".$val['field']."}','{:getUploadServerUrl(".$menuInfo['upload_config_id']."])}');\n";
					}else{
						$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','image',true,'{\$info.".$val['field']."}','{:getUploadServerUrl()}');\n";
					}
					
					$htmlstr .= "setUploadButton('".$val['field']."_upload');\n";
				}
				if($val['type'] == 10 && $val['is_post'] == 1){
					$htmlstr .= "uploader('".$val['field']."_upload','".$val['field']."','file',false,'','{:getUploadServerUrl()}');\n";
				}
			}	
		}
		
		foreach($fieldList as $key=>$val){
			if($val['type'] == 27){
				$htmlstr .="\$(function(){\$('.chosen').chosen({})})\n";
			}
		}
		
		foreach($fieldList as $key=>$val){
			if(in_array($val['type'],[7,12,25])){
				$dateList = \app\admin\controller\Sys\service\FieldSetService::dateList();
				$default_value = explode('|',$val['default_value']);
				$time_format = $dateList[$default_value[0]];
				if(!$time_format || $val['default_value'] == 'null'){
					$time_format = 'datetime';
				}
				$htmlstr .="laydate.render({elem: '#".$val['field']."',type: '".$time_format."',trigger:'click'});\n";
			}
		}
		
		$htmlstr .= "var CodeInfoDlg = {\n";
		$htmlstr .= "	CodeInfoData: {},\n";
		$htmlstr .= "	validateFields: {\n";
		
		foreach($fieldList as $key=>$val){
			$val = checkData($val);
			if((!empty($val['validate']) || !empty($val['rule'])) && $val['type'] != 17){
				$htmlstr .= "		".$val['field'].": {\n";
				$htmlstr .= "			validators: {\n";
				if(in_array('notEmpty',explode(',',$val['validate']))){
					$htmlstr .= "				notEmpty: {\n";
					$htmlstr .= "					message: '".$val['name']."不能为空'\n";
					$htmlstr .= "	 			},\n";
				}
				
				if(!empty($val['rule'])){
					$htmlstr .= "				regexp: {\n";
					$htmlstr .= "					regexp: ".$val['rule'].",\n";
					$htmlstr .= "					message: '".$val['message']."'\n";
					$htmlstr .= "	 			},\n";
				}
				
				$htmlstr .= "	 		}\n";
				$htmlstr .= "	 	},\n";
			}	
		}	
		
		$htmlstr .= "	 }\n";
		$htmlstr .= "}\n\n";
		
		$htmlstr .= "CodeInfoDlg.collectData = function () {\n";
		$htmlstr .="	this";
		
		foreach($fieldList as $key=>$val){
			if(!in_array($val['type'],[3,4,9,16,17,23,32,33])){
				$htmlstr .= ".set('".$val['field']."')";   //去掉单选框 复选框 因为这两个是不能用唯一ID的  去掉百度编辑器 三级联动
			}
			//三级联动
			if($val['type'] == 17 && !empty($val['field'])){
				foreach(explode('|',$val['field']) as $k=>$v){
					$htmlstr .= ".set('".$v."')";
				}
			}
		}
		
		$htmlstr .= ";\n";
		$htmlstr .= "};\n\n";
		
		
		$htmlstr .= "CodeInfoDlg.index = function () {\n";
		$htmlstr .= "	 this.clearData();\n";
		$htmlstr .= "	 this.collectData();\n";
		$htmlstr .= "	 if (!this.validate()) {\n";
		$htmlstr .= "	 	return;\n";
		$htmlstr .= "	 }\n";
		
		foreach($fieldList as $k=>$v){
			if($v['type'] == 3 || $v['type'] == 23){
				$htmlstr .= "	 var ".$v['field']." = $(\"input[name = '".$v['field']."']:checked\").val();\n";
			}
			
			if($v['type'] == 4){
				$htmlstr .= "	 var ".$v['field']." = '';\n";
				$htmlstr .= "	 $('input[name=\"".$v['field']."\"]:checked').each(function(){ \n";
				$htmlstr .= "	 	".$v['field']." += ',' + $(this).val(); \n";
				$htmlstr .= "	 }); \n";
				$htmlstr .= "	  ".$v['field']." = ".$v['field'].".substr(1); \n";
			}
			
			if($v['type'] == 9){
				$htmlstr .= "	 var ".$v['field']." = {};\n";
				$htmlstr .= "	 $(\".".$v['field']." li\").each(function() {\n";
				$htmlstr .="		if($(this).find('img').attr('src')){\n";
				$htmlstr .= "	 		".$v['field']."[\$(this).index()] = {'url':$(this).find('img').attr('src'),'title':$(this).find('input').val()};\n";
				$htmlstr .="		}\n";
				$htmlstr .= "	 });\n";
			}
			
			if($v['type'] == 16){
				$htmlstr .= "	 var ".$v['field']." = UE.getEditor('".$v['field']."').getContent();\n";
			}
			
			if($v['type'] == 32){
				$htmlstr .= "	 var ".$v['field']." = {};\n";
				$htmlstr .= "	 var ".$v['field']."input = $('.".$v['field']."-line');\n";
				$htmlstr .= "	 for (var i = 0; i < ".$v['field']."input.length; i++) {\n";
				$htmlstr .= "		if(".$v['field']."input.eq(i).find('input').eq(0).val() !== ''){\n";
				$htmlstr .= "	 		".$v['field']."[".$v['field']."input.eq(i).find('input').eq(0).val()] = ".$v['field']."input.eq(i).find('input').eq(1).val();\n";
				$htmlstr .=	"		}\n";
				$htmlstr .= "	 };\n";
			}
			
		}	
						
		$htmlstr .= "	 var ajax = new \$ax(Feng.ctxPath + \"/Base/config\", function (data) {\n";
		$htmlstr .= "	 	if ('00' === data.status) {\n";
		$htmlstr .= "	 		Feng.success(data.msg,1000);\n";
		$htmlstr .= "	 	} else {\n";
		$htmlstr .= "	 		Feng.error(data.msg + \"！\",1000);\n";
		$htmlstr .= "		 }\n";
		$htmlstr .= "	 })\n";
		if($fieldList){
			foreach($fieldList as $k=>$v){
				if(in_array($v['type'],[3,4,16,23])){
					$htmlstr .= "	 ajax.set('".$v['field']."',".$v['field'].");\n";
				}
				if(in_array($v['type'],[9,32])){
					$htmlstr .= "	 ajax.set('".$v['field']."',(JSON.stringify(".$v['field'].") == '{}' || JSON.stringify(".$v['field'].") == '{\"\":\"\"}') ? '' : JSON.stringify(".$v['field']."));\n";
				}
				if($v['type'] == 33){
					$htmlstr .= "	 ajax.set('".$v['field']."',".$v['field'].".getMarkdown());\n";
				}
			}	
		}
		
		$htmlstr .= "	 ajax.set(this.CodeInfoData);\n";
		$htmlstr .= "	 ajax.start();\n";
		$htmlstr .= "};\n";
		$htmlstr .= "</script>\n\n\n";
		$htmlstr .= "<script src=\"__PUBLIC__/static/js/base.js\" charset=\"utf-8\"></script>\n";
		$htmlstr .= "{/block}\n";

		$htmlstr = str_replace('col-sm-10','col-sm-7',$htmlstr);
		$htmlstr = str_replace('col-sm-3','col-sm-2',$htmlstr);
		$htmlstr = str_replace('col-sm-6','col-sm-5',$htmlstr);
		
		$rootPath = app()->getRootPath();
		$filepath = $rootPath.'/app/admin/view/base/config.html';
		filePutContents($htmlstr,$filepath,$type=2);
	}
	
	
	/**
     * 生成验证器
     * @param array applicationInfo 应用信息
	 * @param array actionList 操作列表
	 * @param array menuInfo 菜单信息
     * @throws \Exception
     * @return bool
     */
	public function createValidate($actionList,$applicationInfo,$menuInfo){
		$str = '';
		$str = "<?php \n";
		!is_null(config('my.comment.file_comment')) ? config('my.comment.file_comment') : true;
		if(config('my.comment.file_comment')){
		$str .= "/*\n";
		$str .= " module:		".$menuInfo['title']."验证器\n";
		$str .= " create_time:	".date('Y-m-d H:i:s')."\n";
		$str .= " author:		".config('my.comment.author')."\n";
		$str .= " contact:		".config('my.comment.contact')."\n";
		$str .= "*/\n\n";
		}
		$str .= "namespace app\\".$applicationInfo['app_dir']."\\validate".getDbName($menuInfo['controller_name']).";\n";
		$str .="use think\\validate;\n";
		$fieldList = Field::where(['menu_id'=>$menuInfo['menu_id']])->order('sortid asc')->select()->toArray();
		$fieldList = htmlOutList($fieldList);
		$str .="\n";
		$str .= "class ".getControllerName($menuInfo['controller_name'])." extends validate {\n\n\n";
		foreach($fieldList as $k=>$v){
			if((!empty($v['validate']) || !empty($v['rule'])) && !in_array($v['type'],[12,15,21,25,26,30])){
				$rule .="		";
				if(in_array('notEmpty',explode(',',$v['validate']))){
					if($v['type'] == 17){
						foreach(explode('|',$v['field']) as $m=>$n){
							if($m < 2){
								if($m == 0){
									$name = '所属省';
								}
								if($m == 1){
									$name = '所属市';
								}
								$msg .= "		'".$n.".require'".'=>'."'".$name."不能为空',\n";
							}
						}
					}else{
						$rules .= "'require',";
						$msg .= "		'".$v['field'].".require'".'=>'."'".$v['name']."不能为空',\n";
					}
					
				}
				if(in_array('unique',explode(',',$v['validate']))){
					$rules .= "'unique:".$menuInfo['table_name']."',";
					$msg .= "		'".$v['field'].".unique'".'=>'."'".$v['name']."已经存在',\n";
				}
				if(!empty($v['rule'])){
					$rules .= "'regex'=>'".$v['rule']."',";
					if(empty($v['message'])){
						$msg .= "		'".$v['field'].".regex'".'=>'."'".$v['name']."格式错误',\n";
					}else{
						$msg .= "		'".$v['field'].".regex'".'=>'."'".$v['message']."',\n";
					}
				}
				if($v['type'] == 17){
					foreach(explode('|',$v['field']) as $m=>$n){
						if($m < 2){
							$arearule .= "'".$n."'=>['require'],";
						}	
					}
					$rule .= rtrim($arearule,',');
				}else{
					$rule .= "'".$v['field']."'=>[".rtrim($rules,',')."]";
				}
				$rule .=",\n";
				$rules = '';
				$validateFields[] = $v['field'];
			}		
		}
		$scene = '';
		$fields = '';
		foreach($actionList as $k=>$v){
			if(in_array($v['type'],[3,4,7,8,9]) && !empty($v['fields']) && BuildService::checkValidateStatus($v['fields'],$validateFields)){
				$fields = explode(',',$v['fields']);
				foreach($fields as $m=>$j){
					if(in_array($j,$validateFields)){
						if(strpos($j,'|') > 0){
							foreach(explode('|',$j) as $n){
								$areafield .= ",'".$n."'";
							}
							$field .= $areafield;
						}else{
							$field .= ",'".$j."'";
						}
					}
				}
				$scene .="		'".$v['action_name']."'=>[".ltrim($field,',')."],\n";
			}
			$field = '';
			$areafield = '';
		}
		
		if($rule){
			$str .= "	protected \$rule = [\n".$rule."	];\n\n";
			$str .= "	protected \$message = [\n".rtrim($msg,',')."	];\n\n";
			$str .="	protected \$scene  = [\n".$scene."	];\n\n";
			$rootPath = app()->getRootPath();
			$filepath = $rootPath.'/app/'.$applicationInfo['app_dir'].'/validate/'.$menuInfo['controller_name'].'.php';
			filePutContents($str,$filepath,$type=1);
		}
	}
	
	
	/**
     * 生成api接口鉴权路由
     * @param array applicationInfo 应用信息
     * @return str
     */
	private function createRoute($applicationInfo){
		$str .= "<?php\n\n";
		$str .= "//接口路由文件\n\n";
		$str .= "use think\\facade\\Route;\n\n";
		
		$menuId = Menu::where(['app_id'=>$applicationInfo['app_id']])->column('menu_id');
		$where['menu_id'] = $menuId;

		$actionList = Action::where($where)->select();
		$middleware = '';
		if($actionList){
			foreach($actionList as $key=>$val){
				if(!empty($val['api_auth']) || !empty($val['sms_auth']) || !empty($val['captcha_auth'])){
					$menuInfo = Menu::find($val['menu_id']);
					if(!empty($val['captcha_auth'])){
						$middleware .= "'CaptchaAuth',";
					}
					if(!empty($val['api_auth'])){
						$middleware .= "'JwtAuth',";
					}
					
					if(!empty($val['sms_auth'])){
						$middleware .= "'SmsAuth'";
					}
					$str .= "Route::rule('".getUrlName($menuInfo['controller_name'])."/".$val['action_name']."', '".getUrlName($menuInfo['controller_name'])."/".$val['action_name']."')->middleware([".rtrim($middleware,',')."]);	//".$menuInfo['title'].$val['name'].";\n";
				}
				$middleware = '';
			}
		}
		$api_upload_auth = !is_null(config('my.api_upload_auth')) ? config('my.api_upload_auth') : true; 
		if($api_upload_auth){
			$str .= "Route::rule('Base/Upload', 'Base/Upload')->middleware(['JwtAuth']);	//图片上传;\n";
		}
		
		$rootPath = app()->getRootPath();
		$filepath = $rootPath.'app/'.$applicationInfo['app_dir'].'/route/route.php';
		filePutContents($str,$filepath,$type=3);
	}
	

}

