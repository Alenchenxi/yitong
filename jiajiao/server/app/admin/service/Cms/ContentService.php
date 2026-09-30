<?php 
namespace app\admin\service\Cms;
use app\admin\model\Cms\Content;
use app\admin\model\Cms\Catagory;
use think\exception\ValidateException;
use app\admin\controller\Cms\facade\Cat;
use xhadmin\CommonService;

class ContentService extends CommonService {


	/*
 	* @Description  内容管理列表数据
 	*/
	public static function indexList($where,$field,$orderby,$limit,$page){
		try{
			$res = db('content')->field($field)->alias('a')->join('catagory b','a.class_id=b.class_id')->where($where)->order($orderby)->paginate(['list_rows'=>$limit,'page'=>$page]);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res->items(),'total'=>$res->total()];
	}


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		if(empty($data['title']) || empty($data['class_id'])) throw new ValidateException('栏目名称或分类不能为空');
		try{
			$data['create_time'] = time();
			$res = Content::create($data);
			if($res){
				Content::update(['content_id'=>$res->content_id,'sortid'=>$res->content_id]);
				$data['content_id'] = $res->content_id;
				self::saveExtData($data);
			}
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res->content_id;
	}


	/*
 	* @Description  修改      
 	*/
	public static function update($data){
		if(empty($data['title']) || empty($data['class_id'])) throw new ValidateException('栏目名称或分类不能为空');
		try{
			$data['create_time'] = strtotime($data['create_time']);
			$res = Content::update($data);
			self::saveExtData($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res;
	}
	
	
	//更新拓展表信息
	 public static function saveExtData($data){
        $fieldsetInfo = Catagory::find($data['class_id']);	
		try{
			if(!empty($fieldsetInfo['module_id'])){
				$fieldList = db('field')->where(['menu_id'=>$fieldsetInfo['module_id']])->select();
				foreach($fieldList as $k=>$v){
					if($v['type'] == 7){
						$data[$v['field']] = strtotime($data[$v['field']]);
					}
				}
				$extInfo = db("menu")->where('menu_id',$fieldsetInfo['module_id'])->find();
				if($extInfo){
					if(!db($extInfo['table_name'])->where('content_id',$data['content_id'])->find()){
						db($extInfo['table_name'])->insert($data);
					}else{
						db($extInfo['table_name'])->where(['content_id'=>$data['content_id']])->update($data);
					}	
				}
			}
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
        
        return true;
    }

	/*
 	* @Description  删除
 	* @param (输入参数：)  {array}        where 删除条件
 	* @return (返回参数：) {bool}        
 	*/
	public static function delete($where){
		try{
			//判断是否有拓展信息表 有则删除
			foreach($where['content_id'] as $k=>$v){
				$contentInfo = Content::find($v);
				$classInfo = Catagory::find($contentInfo['class_id']);
				if($classInfo){
					$extInfo = db("menu")->where('menu_id',$classInfo['module_id'])->find();
					if($extInfo){
						db($extInfo['table_name'])->where('content_id',$v)->delete();
					}
				}
			}
			$res = Content::destroy($where);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res;
	}
	
	//生成树级结构列表 递归的方法
	public static function getSubClass($pid){
		$list = Catagory::where(['pid'=>$pid])->field('class_id,pid,class_name,class_id as childs')->order('sortid asc,class_id asc')->select();
		foreach($list as $key=>$val){
			$sublist = Catagory::where(['pid'=>$val['class_id']])->field('class_id,pid,class_name,class_id as childs')->order('sortid asc,class_id asc')->select();
			if($sublist){
				$childs = Cat::getSubClassId($list,$val['class_id']);
				$list[$key]['childs'] = $childs;
				$list[$key]['spread'] = !is_null(config('my.content_menu_status')) ? config('my.content_menu_status') : true;
				$list[$key]['children'] = self::getSubClass($val['class_id']);
				foreach($list[$key]['children'] as $k=>$v){
					if(!$v['childs']){
						$list[$key]['children'][$k]['childs'] = $v['class_id'];
					}
				}	
			}
		}
		return $list;
	}
	
	//获取推荐位的名称
	public static function getPositionName($position,$content_id){
		$where['position_id'] = explode(',',ltrim($position,','));
		$list = db("position")->where($where)->select()->toArray();
		if($list){
			foreach($list as $k=>$v){
				$title .= '<a style="color:red" title="点击删除" href="javascript:void(0)" onclick="CodeGoods.delPosition('.$v['position_id'].','.$content_id.')">'.$v['title'].'</a>,';
			}
			
		}
		$title = rtrim($title,',');
		return '<font color="red">['.$title.']</font>';
	}
	
	//批量设置推荐位
	public static function setPosition($content_id,$position_id){
		try{
			$contentInfo = Content::find($content_id);
			if($contentInfo){
				if(strpos($contentInfo['position'],$position_id) == false){
					$data['position'] = ltrim($contentInfo['position'].','.$position_id,',');
					$data['content_id'] = $content_id;
					Content::update($data);
				}
			}
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $reset;	
	}
	
	//批量设置推荐位
	public static function delPosition($content_id,$position_id){
		try{
			$contentInfo = Content::find($content_id);
			if($contentInfo['position']){
				$data['position'] = rtrim(str_replace($position_id.',','',$contentInfo['position'].','),',');
				$data['content_id'] = $content_id;
				Content::update($data);
			}
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $reset;	
	}
	
	
	public function getFieldData($fieldInfo){
		
		switch($fieldInfo['type']){
			
			//文本框
			case 1:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<input type=\"text\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//下拉框
			case 2:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				
				$str .="							<select lay-ignore name=\"".$fieldInfo['field']."\" class=\"form-control\" id=\"".$fieldInfo['field']."\">\n";
				$str .="								<option value=\"\">请选择</option>\n";
				$searchArr = explode(',',$fieldInfo['config']);
				if($searchArr){
					foreach($searchArr as $k=>$v){
						$varArr = explode('|',$v);
						if($defaultValue == $varArr[1]){
							$str .= "								<option selected value=\"".$varArr[1]."\">".$varArr[0]."</option>\n";
						}else{
							$str .= "								<option value=\"".$varArr[1]."\">".$varArr[0]."</option>\n";
						}
					}
				}
				
				$str .= "							</select>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			
			//单选框
			case 3:
				$str .="					<div class=\"form-group layui-form\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}

				$valArr = explode(',',$fieldInfo['config']);
				
				if($valArr){
					foreach($valArr as $k=>$v){
						$varArr = explode('|',$v);
						if($defaultValue == $varArr[1]){
							$str .= "							<input name=\"".$fieldInfo['field']."\" value=\"".$varArr[1]."\" type=\"radio\" checked title=\"".$varArr[0]."\">\n";
						}else{
							$str .= "							<input name=\"".$fieldInfo['field']."\" value=\"".$varArr[1]."\" type=\"radio\" title=\"".$varArr[0]."\">\n";
						}
						
					}
				}
				
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//复选框
			case 4:
				$str .="					<div class=\"form-group layui-form\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
						
				$searchArr = explode(',',$fieldInfo['config']);
				
				if($searchArr){
					foreach($searchArr as $k=>$v){
						$varArr = explode('|',$v);
						if(in_array($varArr[1],explode(',',$defaultValue))){
							$str .= "								<input name=\"".$fieldInfo['field']."\" checked value=\"".$varArr[1]."\" type=\"checkbox\" title=\"".$varArr[0]."\">\n";
						}else{
							$str .= "								<input name=\"".$fieldInfo['field']."\" value=\"".$varArr[1]."\" type=\"checkbox\" title=\"".$varArr[0]."\">\n";
						}
					}
				}
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			
			//文本域
			case 6:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<textarea id=\"".$fieldInfo['field']."\" name=\"".$fieldInfo['field']."\"  class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">".$defaultValue."</textarea>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//日期选择框
			case 7:
				
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id'])){
					$defaultValue = date('Y-m-d H:i:s');
				}else{
					if(!empty($fieldInfo['value'])){
						$defaultValue = date('Y-m-d H:i:s',$fieldInfo['value']);
					}
				}
				
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";

				$str .="							<input type=\"text\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\"  placeholder=\"请输入".$fieldInfo['name']."\" class=\"form-control layer-date\" onclick=\"laydate({istime: true, format: 'YYYY-MM-DD hh:mm:ss'})\" id=\"".$fieldInfo['field']."\">\n";
				
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//单图上传
			case 8:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-6\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<input type=\"text\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" onmousemove=\"showBigPic(this.value)\" onmouseout=\"closeimg()\"  name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
					$str .="							<span class=\"help-block m-b-none ".$fieldInfo['field']."_process\">".$fieldInfo['note']."</span>\n";
				$str .="						</div>\n";
				$str .="						<div class=\"col-sm-3\" style=\"position:relative; right:30px;\">\n";
				$str .="							<span id=\"".$fieldInfo['field']."_upload\"></span>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//多图上传
			case 9:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-6\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = html_in($fieldInfo['value']);
				}
				$str .="							<input type=\"hidden\" id=\"".$fieldInfo['field']."_images\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				$str .="							<div class=\"".$fieldInfo['field']." pic_list\">\n";
				$str .="								<li id=\"".$fieldInfo['field']."_upload\"></li>\n";
				$str .="							</div>\n";
				$str .="							<div style=\"clear:both\"></div>\n";
				$str .="							<span class=\"help-block m-b-none ".$fieldInfo['field']."_process\">".$fieldInfo['note']."</span>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//文件上传
			case 10:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-6\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<input type=\"text\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				$str .="							<span class=\"help-block m-b-none ".$fieldInfo['field']."_process\">".$fieldInfo['note']."</span>\n";
				$str .="						</div>\n";
				$str .="						<div class=\"col-sm-3\" style=\"position:relative; right:30px;\">\n";
				$str .="							<span id=\"".$fieldInfo['field']."_upload\"></span>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//xheditor编辑器
			case 11:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="								<textarea id=\"".$fieldInfo['field']."\" name=\"".$fieldInfo['field']."\" style=\"width: 100%; height:300px;\">".$defaultValue."</textarea>\n";
				$str .="								<script type=\"text/javascript\">$('#".$fieldInfo['field']."').xheditor({html5Upload:false,upLinkUrl:\"".url('admin/Upload/editorUpload',['immediate'=>1])."\",upLinkExt:\"zip,rar,txt,doc,docx,pdf,xls,xlsx\",tools:'simple',upImgUrl:\"".url('admin/Upload/editorUpload',['immediate'=>1])."\",upImgExt:\"jpg,jpeg,gif,png\"});</script>\n";
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//货币
			case 13:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<input type=\"text\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			
			//百度编辑器
			case 16:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<script id=\"".$fieldInfo['field']."\" type=\"text/plain\" name=\"".$fieldInfo['field']."\" style=\"width:100%;height:300px;\">".$defaultValue."</script>\n";
				$str .="							<script type=\"text/javascript\">\n";
				$str .="								var ue = UE.getEditor('".$fieldInfo['field']."');\n";
				$str .="								scaleEnabled:true\n";
				$str .="							</script>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//地区三级联动
			case 17:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"distpicker5\">\n";
				
				foreach(explode("|",$fieldInfo['field']) as $k=>$v){
					if($k == '0'){
						$areaTitle = 'province';
					}elseif($k == '1'){
						$areaTitle = 'city';
					}elseif($k == '2'){
						$areaTitle = 'district';
					}
					$str .="							<div class=\"col-sm-3\">\n";
					if(!isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
						$defaultValue = explode('|',$fieldInfo['default_value']);	
					}
					$str .="								<select lay-ignore id=\"".$v."\" class=\"form-control\" data-".$areaTitle."=\"".$fieldInfo[$v]."\"></select>\n";
					$str .="							</div>\n";
				}	
				
				$str .="						</div>\n";
				$str .="					</div>\n";
				$str .="					<script src=\"/static/js/plugins/shengshiqu/distpicker.data.js\"></script>\n";
				$str .="					<script src=\"/static/js/plugins/shengshiqu/distpicker.js\"></script>\n";
				$str .="					<script src=\"/static/js/plugins/shengshiqu/main.js\"></script>\n";
			break;
			
			//颜色选择器
			case 18:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div id=\"mycp\">\n";
				$str .="							<div class=\"col-sm-8\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="								<input type=\"text\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="								<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				$str .="							</div>\n";
				$str .="							<div class=\"col-sm-1\">\n";
				$str .="								<span style=\"border:none; margin-left:-30px;  padding:0;\" class=\"input-group-addon col-sm-2\"><i style=\"width:32px; height:32px;\"></i></span>\n";
				
				$str .="							</div>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
				
				$str .="					<link href=\"/static/js/plugins/colorpicker/bootstrap-colorpicker.css\" rel=\"stylesheet\">\n";
				$str .="					<script src=\"/static/js/plugins/colorpicker/bootstrap-colorpicker.js\"></script>\n";
				$str .="					<script type=\"text/javascript\">\n";
				$str .="					$(function () {\n";
				$str .="						$('#mycp').colorpicker();\n";
				if(empty($defaultValue)){
					$str .="							$('#".$fieldInfo['field']."').val('');\n";
				}
				$str .="					});\n";
				$str .="					</script>\n";
			break;
			
			//标签输入
			case 28:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if(!isset($fieldInfo['data_id']) && !isset($fieldInfo['content_id']) && !empty($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = $fieldInfo['value'];
				}
				$str .="							<input type=\"text\" class=\"form-control\" data-role=\"tagsinput\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\"  >\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			
			//键值对
			case 32:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				$str .="							<div class=\"".$fieldInfo['field']."\">\n";
				$fieldInfo['value'] = json_decode($fieldInfo['value'],true);
				foreach($fieldInfo['value'] as $k=>$v){
				$str .="								<div class=\"".$fieldInfo['field']."-line\">\n";
				$str .="									<label class=\"form-inline\" style=\"font-weight:normal;\">\n";
				$str .="										<input type=\"text\" value=\"".$k."\" class=\"form-control\" placeholder=\"名称\">\n";
				$str .="									</label>\n";
				$str .="									<label class=\"form-inline\" style=\"font-weight:normal;\">\n";
				$str .="										<input type=\"text\" value=\"".$v."\" class=\"form-control\" placeholder=\"值\">\n";
				$str .="									</label>\n";
				$str .="									<label class=\"form-inline btn-group-sm\">\n";
				$str .="										<button type=\"button\" class=\"btn btn-danger cancel\"><i class=\"fa fa-remove\"></i></button>\n";
				$str .="										<button type=\"button\" class=\"btn btn-info move\"><i class=\"fa fa-arrows\"></i></button>\n";
				$str .="									</label>\n";
				$str .="								</div>\n";
				}
				$str .="							</div>\n";
				$str .="							<a class=\"btn btn-primary btn-xs\" onclick=\"appendToVal('".$fieldInfo['field']."')\"><i class=\"fa fa-plus\"></i>&nbsp;追加</a>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
		}
		
		return $str;
	}



}

