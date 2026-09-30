<?php

namespace app\admin\controller\Sys\service;
use app\admin\controller\Sys\model\Menu;
use app\admin\controller\Sys\model\Field;
use think\facade\Validate;
use xhadmin\CommonService;


class FieldService extends CommonService
{

	 /*
     * @Description  添加或修改信息
	 * @param (输入参数：)  {string}        type 操作类型 add 添加 update修改
     * @param (输入参数：)  {array}         data 原始数据
     * @return (返回参数：) {bool}        
	 */
	public static function saveData($type,$data){
		try{
			//调用验证器
			$rule = [
				'name'  => 'require',
				'field' => 'require',
				'type' => 'require'
			];
			
			$msg = [
				'name.require'  => '字段名称必填',
				'field.require'  => '字段必填',
				'type.require'=>'字段类型必填',
			];
			
			$validate = Validate::rule($rule)->message($msg);	
			if (!$validate->check($data)) {
				throw new ValidateException($validate->getError());
			}
			$field_letter_status = !is_null(config('my.field_letter_status')) ? config('my.field_letter_status') : true;
			if($field_letter_status){
				$data['field'] = strtolower(trim($data['field'])); //字段强制小写
			}

			if($type == 'add'){
				$info = Field::where(['menu_id'=>$data['menu_id'],'field'=>$data['field']])->find();
				$reset = Field::create($data);	//创建操作字段
				if($reset->id){
					Field::update(['id'=>$reset->id,'sortid'=>$reset->id]); //更新排序
				}
				if($data['type'] == 22){
					$arrinfo = db("action")->where('type',30)->where('menu_id',$data['menu_id'])->find();
					if(!$arrinfo){
						$dt['menu_id'] = $data['menu_id'];
						$dt['type'] = 30;
						$dt['name'] = '箭头排序';
						$dt['action_name'] = 'arrowsort';
						$pk = db("action")->insertGetId($dt);
						if($pk){
							db("action")->where('id',$pk)->update(['sortid'=>$pk]);
						}
					}
				}
				
				//添加字段同时绑定到 添加 修改 查看详情方法
				$actionList = db("action")->field('id,type,fields')->where('menu_id',$data['menu_id'])->where('type','in',[3,4,15])->select()->toArray();
				if($actionList && $data['is_field']){
					foreach($actionList as $k=>$v){
						$param['fields'] = $v['fields'].','.$data['field'];
						$fieldcount = count(explode(',',$param['fields']));
						if($fieldcount <= 3){
							$width = '600px';
							$height = ($fieldcount * 50 + 300).'px';
						}elseif($fieldcount >3 && $fieldcount<=8){
							$width = '800px';
							$height = ($fieldcount * 50 + 200).'px';
						}else{
							$width = '800px';
							$height = '100%';
						}
						$param['remark'] = $width.'|'.$height;
						db("action")->where('id',$v['id'])->update($param);
					}
				}
			}elseif($type == 'edit'){
				$res = Field::update($data);
				if($res){
					$fieldInfo = Field::find($data['id']);
					if($data['name'] == '编号' && $data['field'] <> $fieldInfo['field']){
						Menu::update(['pk_id'=>$data['field'],'menu_id'=>$fieldInfo['menu_id']]);
					}
				}
			}
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}
			
		return $reset;
	}
	
	
	/**
     * 移动排序
	 * @param (输入参数：)  {string}        id 当前ID
     * @param (输入参数：)  {string}        type 类型 1上移 2 下移
     * @return (返回参数：) {bool}        
     * @return bool 信息
     */
	public static function arrowsort($id,$type){
		$data = Field::find($id);

		if($type == 1){
			$map = 'sortid < '.$data['sortid'].' and menu_id = '.$data['menu_id'];
			$info = Field::where($map)->order('sortid desc')->find();
		}else{
			$map = 'sortid > '.$data['sortid'].' and menu_id = '.$data['menu_id'];
			$info = Field::where($map)->order('sortid asc')->find();
		}
		try{
			if($info && $data){
				Field::update(['id'=>$id,'sortid'=>$info['sortid']]);
				Field::update(['id'=>$info['id'],'sortid'=>$data['sortid']]);
			}else{
				throw new \Exception('目标位置没有数据');
			}
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}
		 return true;
		
	}

    
}
