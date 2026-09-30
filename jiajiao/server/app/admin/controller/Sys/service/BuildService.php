<?php

namespace app\admin\controller\Sys\service;
use xhadmin\CommonService;
use app\admin\controller\Sys\model\Field;
use app\admin\controller\Sys\service\ExtendService;
use think\facade\Db;

class BuildService extends CommonService
{
	
	
	
	//生成时间区间筛选框
	public static function createTimeSearch($val){
		$htmlstr .= "							<div class=\"col-sm-3\">\n";
		$htmlstr .= "								<div class=\"input-group\">\n";
		$htmlstr .= "									<div class=\"input-group-btn\">\n";
		$htmlstr .= "										<button data-toggle=\"dropdown\" class=\"btn btn-white dropdown-toggle\" type=\"button\">".$val['name']."范围</button>\n";
		$htmlstr .= "									</div>\n";
		$htmlstr .= "									<input type=\"text\" autocomplete=\"off\" placeholder=\"时间范围\" class=\"form-control\" id=\"".$val['field']."\">\n";
		$htmlstr .= "								</div>\n";
		$htmlstr .= "							</div>\n";	
		
		return $htmlstr;
	}
	
	
	//生成数字区间筛选框
	public static function createNumSearch($val){
		$htmlstr .= "							<div class=\"col-sm-2\">\n";
		$htmlstr .= "								<div class=\"input-group\">\n";
		$htmlstr .= "									<div class=\"input-group-btn\">\n";
		$htmlstr .= "										<button data-toggle=\"dropdown\" class=\"btn btn-white dropdown-toggle\" type=\"button\">".$val['name']."开始</button>\n";
		$htmlstr .= "									</div>\n";
		$htmlstr .= "									<input type=\"text\" autocomplete=\"off\" placeholder=\"起始".$val['name']."\" class=\"form-control layer-date\" id=\"".$val['field']."_start\">\n";
		$htmlstr .= "								</div>\n";
		$htmlstr .= "							</div>\n";	
		
		$htmlstr .= "							<div class=\"col-sm-2\">\n";
		$htmlstr .= "								<div class=\"input-group\">\n";
		$htmlstr .= "									<div class=\"input-group-btn\">\n";
		$htmlstr .= "										<button data-toggle=\"dropdown\" class=\"btn btn-white dropdown-toggle\" type=\"button\">".$val['name']."结束</button>\n";
		$htmlstr .= "									</div>\n";
		$htmlstr .= "									<input type=\"text\" autocomplete=\"off\" placeholder=\"结束".$val['name']."\" class=\"form-control\" id=\"".$val['field']."_end\">\n";
		$htmlstr .= "								</div>\n";
		$htmlstr .= "							</div>\n";
		
		return $htmlstr;
	}
	
	
	
	//生成三级联动搜索框
	public static function createDistaitSearch($val){
		$htmlstr .="							<div class=\"distpicker5\">\n";
		foreach(explode("|",$val['field']) as $m=>$n){
			if($m=='0'){
				$areaTitle = '省';
			}elseif($m == '1'){
				$areaTitle = '市';
			}elseif($m == '2'){
				$areaTitle = '区';
			}
			$htmlstr .="								<div class=\"col-sm-2\">\n";
			$htmlstr .="									<div class=\"input-group\">\n";
			$htmlstr .="										<div class=\"input-group-btn\">\n";
			$htmlstr .="											<button data-toggle=\"dropdown\" class=\"btn btn-white dropdown-toggle\" type=\"button\">".$areaTitle."</button>\n";
			$htmlstr .="										</div>\n";
			
			$htmlstr .="										<select lay-ignore id=\"".$n."\" class=\"form-control\" ></select>\n";
			$htmlstr .="									</div>\n";
			$htmlstr .="								</div>\n";
		}
		$htmlstr .="							</div>\n";
		$htmlstr .="							<script src=\"__PUBLIC__/static/js/plugins/shengshiqu/distpicker.data.js\"></script>\n";
		$htmlstr .="							<script src=\"__PUBLIC__/static/js/plugins/shengshiqu/distpicker.js\"></script>\n";
		$htmlstr .="							<script src=\"__PUBLIC__/static/js/plugins/shengshiqu/main.js\"></script>\n";
		
		return $htmlstr;
	}
	
	
	//普通搜索框
	public static function createNormaiSearch($v){
		$htmlstr .= "							<div class=\"col-sm-2\">\n";
		$htmlstr .= "								<div class=\"input-group\">\n";
		$htmlstr .= "									<div class=\"input-group-btn\">\n";
		$htmlstr .= "										<button data-toggle=\"dropdown\" class=\"btn btn-white dropdown-toggle\" type=\"button\">".$v['name']."</button>\n";
		$htmlstr .= "									</div>\n";
		
		if(in_array($v['type'],[1,6,20,21,28,30])){
			if($v['field'] == 'name'){
				$v['field'] = 'name_s';
			}
			$htmlstr .= "									<input type=\"text\" autocomplete=\"off\" class=\"form-control\" id=\"".$v['field']."\" placeholder=\"".$v['name']."\" />\n";
		}
		
		//搜索框看是否存在sql数据源
		if(in_array($v['type'],[2,3,4,23,27,29])){
			if($v['type'] == 29){
				$htmlstr .= "									<select class=\"form-control chosen\" id=\"".$v['field']."\">\n";
			}else{
				$htmlstr .= "									<select class=\"form-control\" id=\"".$v['field']."\">\n";
			}
			$htmlstr .= "										<option value=\"\">请选择</option>\n";
			
			if(empty($v['sql'])){
				$searchArr = explode(',',$v['config']);
				if($searchArr){
					foreach($searchArr as $k=>$v){
						$valArr = explode('|',$v);
						$htmlstr .= "										<option value=\"".$valArr[1]."\">".$valArr[0]."</option>\n";
					}
				}
			}else{
				$menuInfo = db("menu")->where('menu_id',$v['menu_id'])->find();
				$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
				if($connect){
					$htmlstr .="										{sql connect=\"".$connect."\" query=\"".$v['sql']."\"}\n";
				}else{
					$htmlstr .="										{sql query=\"".$v['sql']."\"}\n";
				}
				$sqlvalue = [];
				$all = [];
				preg_match_all('/select(.*)from/iUs',$v['sql'],$all);
				if(!empty($all[1][0])){
					$sqlvalue = explode(',',$all[1][0]);
					foreach($sqlvalue as $key=>$val){
						if(preg_match('/[\s]+as[\s]+/',strtolower($val))){
							$sqlvalue[$key] = preg_split("/\s+/", $val)[2];
						}
					}
				}
				
				$htmlstr .="										<option value=\"{\$sql.".trim($sqlvalue[0])."}\">{\$sql.".trim($sqlvalue[1])."}</option>\n";
				$htmlstr .="										{/sql}\n";
			}
				
			$htmlstr .= "									</select>\n";
		}
		
		$htmlstr .= "								</div>\n";
		$htmlstr .= "							</div>\n";
		
		return $htmlstr;
	}
	
	//表单模型
	public static function formGroup($fieldInfo,$type,$applicationInfo,$menuInfo){
		
		switch($fieldInfo['type']){
			
			//文本框
			case 1:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
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
				
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
					$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = '".$defaultValue."'; }; ?>\n";	
				}
				
				$str .="							<select lay-ignore name=\"".$fieldInfo['field']."\" class=\"form-control\" id=\"".$fieldInfo['field']."\">\n";
				$str .="								<option value=\"\">请选择</option>\n";
				//如果不存在sql语句的数据源则调用配置信息的
				if(empty($fieldInfo['sql'])){
					$searchArr = explode(',',$fieldInfo['config']);
					if($searchArr){
						foreach($searchArr as $k=>$v){
							$varArr = explode('|',$v);
							$str .= "								<option value=\"".$varArr[1]."\" {if condition=\"\$info.".$fieldInfo['field']." eq '".$varArr[1]."'\"}selected{/if}>".$varArr[0]."</option>\n";
						}
					}
				}else{
					$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
					if($connect){
						$str .="								{sql connect=\"".$connect."\" query=\"".$fieldInfo['sql']."\"}\n";
					}else{
						$str .="								{sql query=\"".$fieldInfo['sql']."\"}\n";
					}
					$sqlvalue = [];
					$all = [];
					preg_match_all('/select(.*)from/iUs',$fieldInfo['sql'],$all);
					if(!empty($all[1][0])){
						$sqlvalue = explode(',',$all[1][0]);
						foreach($sqlvalue as $key=>$val){
							if(preg_match('/[\s]+as[\s]+/',strtolower($val))){
								$sqlvalue[$key] = preg_split("/\s+/", $val)[2];
							}
						}
					}
					$str .="									<option value=\"{\$sql.".trim($sqlvalue[0])."}\" {if condition=\"\$info.".$fieldInfo['field']." eq \$sql.".trim($sqlvalue[0])."\"}selected{/if}>{\$sql.".trim($sqlvalue[1])."}</option>\n";
					$str .="								{/sql}\n";
				}
				
				
				$str .= "							</select>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//下拉多选
			case 27:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
					$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = '".$defaultValue."'; }; ?>\n";	
				}
				
				$str .="							<select lay-ignore name=\"".$fieldInfo['field']."\" class=\"form-control chosen\" multiple data-placeholder='请选择".$fieldInfo['name']."'  id=\"".$fieldInfo['field']."\">\n";
				//如果不存在sql语句的数据源则调用配置信息的
				if(empty($fieldInfo['sql'])){
					$searchArr = explode(',',$fieldInfo['config']);
					if($searchArr){
						foreach($searchArr as $k=>$v){
							$varArr = explode('|',$v);
							$str .= "								<option value=\"".$varArr[1]."\" {if in_array(\"".$varArr[1]."\",explode(',',\$info.".$fieldInfo['field']."))}selected{/if}>".$varArr[0]."</option>\n";
						}
					}
				}else{
					$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
					if($connect){
						$str .="								{sql connect=\"".$connect."\" query=\"".$fieldInfo['sql']."\"}\n";
					}else{
						$str .="								{sql query=\"".$fieldInfo['sql']."\"}\n";
					}
					$sqlvalue = [];
					$all = [];
					preg_match_all('/select(.*)from/iUs',$fieldInfo['sql'],$all);
					if(!empty($all[1][0])){
						$sqlvalue = explode(',',$all[1][0]);
						foreach($sqlvalue as $key=>$val){
							if(preg_match('/[\s]+as[\s]+/',strtolower($val))){
								$sqlvalue[$key] = preg_split("/\s+/", $val)[2];
							}
						}
					}
					
					
					
					$str .="									<option value=\"{\$sql.".trim($sqlvalue[0])."}\" {if in_array(\$sql.".trim($sqlvalue[0]).",explode(',',\$info['".$fieldInfo['field']."']))}selected{/if}>{\$sql.".trim($sqlvalue[1])."}</option>\n";
					$str .="								{/sql}\n";
				}
				
				
				$str .= "							</select>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//下拉(带搜索)
			case 29:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
					$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = '".$defaultValue."'; }; ?>\n";	
				}
				
				$str .="							<select lay-ignore name=\"".$fieldInfo['field']."\" class=\"form-control chosen\" data-placeholder='请选择".$fieldInfo['name']."'  id=\"".$fieldInfo['field']."\">\n";
				$str .="								<option value=\"\">请选择</option>\n";
				//如果不存在sql语句的数据源则调用配置信息的
				//如果不存在sql语句的数据源则调用配置信息的
				if(empty($fieldInfo['sql'])){
					$searchArr = explode(',',$fieldInfo['config']);
					if($searchArr){
						foreach($searchArr as $k=>$v){
							$varArr = explode('|',$v);
							$str .= "								<option value=\"".$varArr[1]."\" {if condition=\"\$info.".$fieldInfo['field']." eq '".$varArr[1]."'\"}selected{/if}>".$varArr[0]."</option>\n";
						}
					}
				}else{
					$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
					if($connect){
						$str .="								{sql connect=\"".$connect."\" query=\"".$fieldInfo['sql']."\"}\n";
					}else{
						$str .="								{sql query=\"".$fieldInfo['sql']."\"}\n";
					}
					$sqlvalue = [];
					$all = [];
					preg_match_all('/select(.*)from/iUs',$fieldInfo['sql'],$all);
					if(!empty($all[1][0])){
						$sqlvalue = explode(',',$all[1][0]);
						foreach($sqlvalue as $key=>$val){
							if(preg_match('/[\s]+as[\s]+/',strtolower($val))){
								$sqlvalue[$key] = preg_split("/\s+/", $val)[2];
							}
						}
					}
					
					$str .="									<option value=\"{\$sql.".trim($sqlvalue[0])."}\" {if condition=\"\$info.".$fieldInfo['field']." eq \$sql.".trim($sqlvalue[0])."\"}selected{/if}>{\$sql.".trim($sqlvalue[1])."}</option>\n";
					$str .="								{/sql}\n";
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

				if(empty($fieldInfo['sql'])){
					$valArr = explode(',',$fieldInfo['config']);
					$value = (string) $fieldInfo['default_value'];
					if(empty($value) && $value <> '0'){
						$defaultValue = explode('|',$valArr[0])[1];
					}else{
						$defaultValue = $fieldInfo['default_value'];	
					}		
					$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = '".$defaultValue."'; }; ?>\n";				
					if($valArr){
						foreach($valArr as $k=>$v){
							$varArr = explode('|',$v);						
							$str .= "							<input name=\"".$fieldInfo['field']."\" value=\"".$varArr[1]."\" type=\"radio\" {if condition=\"\$info.".$fieldInfo['field']." eq '".$varArr[1]."'\"}checked{/if} title=\"".$varArr[0]."\">\n";
							
						}
					}
				}else{
					if($type == 3 && !is_null($fieldInfo['default_value'])){
						$defaultValue = $fieldInfo['default_value'];
						if($defaultValue){
							$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = ".$defaultValue."; }; ?>\n";	
						}
					}
					
					
					$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
					if($connect){
						$str .="								{sql connect=\"".$connect."\" query=\"".$fieldInfo['sql']."\"}\n";
					}else{
						$str .="								{sql query=\"".$fieldInfo['sql']."\"}\n";
					}
					$sqlvalue = [];
					$all = [];
					preg_match_all('/select(.*)from/iUs',$fieldInfo['sql'],$all);
					if(!empty($all[1][0])){
						$sqlvalue = explode(',',$all[1][0]);
						foreach($sqlvalue as $key=>$val){
							if(preg_match('/[\s]+as[\s]+/',strtolower($val))){
								$sqlvalue[$key] = preg_split("/\s+/", $val)[2];
							}
						}
					}
					
					$str .= "							<input name=\"".$fieldInfo['field']."\" value=\"{\$sql.".trim($sqlvalue[0])."}\" type=\"radio\" {if condition=\"\$info.".$fieldInfo['field']." eq \$sql.".trim($sqlvalue[0])."\"}checked{/if} title=\"{\$sql.".trim($sqlvalue[1])."}\">\n";

					$str .="								{/sql}\n";
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
				
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
					$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = '".$defaultValue."'; }; ?>\n";	
				}
				
				if(empty($fieldInfo['sql'])){				
					$searchArr = explode(',',$fieldInfo['config']);
					
					if($searchArr){
						foreach($searchArr as $k=>$v){
							$varArr = explode('|',$v);
							$str .= "								<input name=\"".$fieldInfo['field']."\" value=\"".$varArr[1]."\" type=\"checkbox\" {if in_array(".$varArr[1].",explode(',',\$info['".$fieldInfo['field']."']))}checked{/if} title=\"".$varArr[0]."\">\n";
						}
					}
				}else{
					$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
					if($connect){
						$str .="								{sql connect=\"".$connect."\" query=\"".$fieldInfo['sql']."\"}\n";
					}else{
						$str .="								{sql query=\"".$fieldInfo['sql']."\"}\n";
					}
					$sqlvalue = [];
					$all = [];
					preg_match_all('/select(.*)from/iUs',$fieldInfo['sql'],$all);
					if(!empty($all[1][0])){
						$sqlvalue = explode(',',$all[1][0]);
						foreach($sqlvalue as $key=>$val){
							if(preg_match('/[\s]+as[\s]+/',strtolower($val))){
								$sqlvalue[$key] = preg_split("/\s+/", $val)[2];
							}
						}
					}
					
					$str .="									<input name=\"".$fieldInfo['field']."\" value=\"{\$sql.".trim($sqlvalue[0])."}\" type=\"checkbox\" {if in_array(\$sql.".trim($sqlvalue[0]).",explode(',',\$info['".$fieldInfo['field']."']))}checked{/if} title=\"{\$sql.".trim($sqlvalue[1])."}\">\n";
					$str .="								{/sql}\n";
				}
				
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			
			//密码框
			case 5:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"password\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
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
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
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
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				
				$default_time_format = explode('|',$fieldInfo['default_value']);
				if(!$fieldInfo['default_value'] || $fieldInfo['default_value'] == 'null'){
					$time_format = 'Y-m-d H:i:s';
				}else{
					$time_format = $default_time_format[0];
				}
				
				if($default_time_format[1] == 'null' || $fieldInfo['default_value'] == 'null'){
					$time = '';
				}else{
					$time = "{:date('".$time_format."')}";
				}
				
				if($type == 4){
					$time = "{if condition=\"\$info.".$fieldInfo['field']." neq 0\"}{\$info.".$fieldInfo['field']."|date='".$time_format."'}{/if}";
				}
				
				$str .="							<input type=\"text\" autocomplete=\"off\" value=\"".$time."\" name=\"".$fieldInfo['field']."\"  placeholder=\"请输入".$fieldInfo['name']."\" class=\"form-control\" id=\"".$fieldInfo['field']."\">\n";
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
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" {if condition=\"config('my.img_show_status') eq true\"}onmousemove=\"showBigPic(this.value)\" onmouseout=\"closeimg()\"{/if} name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				

				$str .="							<span class=\"help-block m-b-none ".$fieldInfo['field']."_process\">".$fieldInfo['note']."</span>\n";
				
				
				$str .="						</div>\n";
				$str .="						<div class=\"col-sm-2\" style=\"position:relative; right:30px;\">\n";
				$str .="							<span id=\"".$fieldInfo['field']."_upload\"></span>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//多图上传
			case 9:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-6\">\n";
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
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				$str .="							<span class=\"help-block m-b-none ".$fieldInfo['field']."_process\">".$fieldInfo['note']."</span>\n";
				$str .="						</div>\n";
				$str .="						<div class=\"col-sm-3\" style=\"position:relative; right:30px;\">\n";
				$str .="							<span id=\"".$fieldInfo['field']."_upload\"></span>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//多文件上传
			case 34:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-8\">\n";
				$str .="							<span id=\"".$fieldInfo['field']."_upload\"></span>\n";
				$str .="							<div class=\"".$fieldInfo['field']."\"></div>\n";
				$str .="							<span class=\"help-block m-b-none ".$fieldInfo['field']."_process\">".$fieldInfo['note']."</span>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//xheditor编辑器
			case 11:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="								<textarea id=\"".$fieldInfo['field']."\" name=\"".$fieldInfo['field']."\" style=\"width: 100%; height:300px;\">".$defaultValue."</textarea>\n";
				if($menuInfo['upload_config_id']){
					$str .="								<script type=\"text/javascript\">$('#".$fieldInfo['field']."').xheditor({html5Upload:false,upLinkUrl:\"{:url('".$applicationInfo['app_dir']."/Upload/editorUpload',['upload_config_id'=>".$menuInfo['upload_config_id']."])}\",upLinkExt:\"zip,rar,txt,doc,docx,pdf,xls,xlsx\",upImgUrl:\"{:url('".$applicationInfo['app_dir']."/Upload/editorUpload',['upload_config_id'=>".$menuInfo['upload_config_id']."])}\",upImgExt:\"jpg,jpeg,gif,png\"});</script>\n";
				}else{
					$str .="								<script type=\"text/javascript\">$('#".$fieldInfo['field']."').xheditor({html5Upload:false,upLinkUrl:\"{:url('".$applicationInfo['app_dir']."/Upload/editorUpload')}\",upLinkExt:\"zip,rar,txt,doc,docx,pdf,xls,xlsx\",upImgUrl:\"{:url('".$applicationInfo['app_dir']."/Upload/editorUpload')}\",upImgExt:\"jpg,jpeg,gif,png\"});</script>\n";
				}
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			
			//后台创建时间
			case 12:
				if($type == 4){
					$str .="					<div class=\"form-group\">\n";
					$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
					$str .="						<div class=\"col-sm-9\">\n";
					$default_time_format = explode('|',$fieldInfo['default_value']);
					$time_format = $default_time_format[0];
					if(!$time_format || $fieldInfo['default_value'] == 'null'){
						$time_format = 'Y-m-d H:i:s';
					}
					
					$time = "{if condition=\"\$info.".$fieldInfo['field']." neq ''\"}{\$info.".$fieldInfo['field']."|date='".$time_format."'}{/if}";
					$str .="							<input type=\"text\" autocomplete=\"off\" value=\"".$time."\" name=\"".$fieldInfo['field']."\"  placeholder=\"请输入".$fieldInfo['name']."\" class=\"form-control\" id=\"".$fieldInfo['field']."\">\n";
					if(!empty($fieldInfo['note'])){
						$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
					}
					
					$str .="						</div>\n";
					$str .="					</div>\n";
				}
				
			break;
			
			//货币
			case 13:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//隐藏域
			case 14:
				if($type == 3){
					if($fieldInfo['default_value'] || $fieldInfo['default_value'] == '0'){
						$defaultValue = $fieldInfo['default_value'];
					}else{
						$defaultValue = '{$Request.get.'.$fieldInfo['field'].'}';
					}
					
					$str .="					<input type=\"hidden\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\">\n";
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
					$str .="					<div class=\"form-group\">\n";
					$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
					$str .="						<div class=\"col-sm-9\">\n";
					$str .="							<input type=\"text\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
					if(!empty($fieldInfo['note'])){
						$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
					}
					
					$str .="						</div>\n";
					$str .="					</div>\n";
				}
			break;
			
			//百度编辑器
			case 16:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<script id=\"".$fieldInfo['field']."\" type=\"text/plain\" name=\"".$fieldInfo['field']."\" style=\"width:100%;height:300px;\">".$defaultValue."</script>\n";
				$str .="							<script type=\"text/javascript\">\n";
				if($menuInfo['upload_config_id']){
					$str .="								var ue = UE.getEditor('".$fieldInfo['field']."',{serverUrl : '{:url(\"".$applicationInfo['app_dir']."/Upload/uploadUeditor\",[\"upload_config_id\"=>".$menuInfo['upload_config_id']."])}'});\n";
				}else{
					$str .="								var ue = UE.getEditor('".$fieldInfo['field']."',{serverUrl : '{:url(\"".$applicationInfo['app_dir']."/Upload/uploadUeditor\")}'});\n";
				}
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
					if($type == 3 && !empty($fieldInfo['default_value'])){
						$defaultValue = explode('|',$fieldInfo['default_value']);
						if(!empty($defaultValue[$k])){
							$str .="							<?php if(!isset(\$info['".$v."'])){ \$info['".$v."'] = '".$defaultValue[$k]."'; }; ?>\n";	
						}
					}
					$str .="								<select lay-ignore id=\"".$v."\" class=\"form-control\" data-".$areaTitle."=\"{\$info.".$v."}\"></select>\n";
					$str .="							</div>\n";
				}	
				
				$str .="						</div>\n";
				$str .="					</div>\n";
				$str .="					<script src=\"__PUBLIC__/static/js/plugins/shengshiqu/distpicker.data.js\"></script>\n";
				$str .="					<script src=\"__PUBLIC__/static/js/plugins/shengshiqu/distpicker.js\"></script>\n";
				$str .="					<script src=\"__PUBLIC__/static/js/plugins/shengshiqu/main.js\"></script>\n";
			break;
			
			//颜色选择器
			case 18:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"".$fieldInfo['field']."\">\n";
				$str .="							<div class=\"col-sm-8\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
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
				
				$str .="					<link href=\"__PUBLIC__/static/js/plugins/colorpicker/bootstrap-colorpicker.css\" rel=\"stylesheet\">\n";
				$str .="					<script src=\"__PUBLIC__/static/js/plugins/colorpicker/bootstrap-colorpicker.js\"></script>\n";
				$str .="					<script type=\"text/javascript\">\n";
				$str .="					$(function () {\n";
				$str .="						$('.".$fieldInfo['field']."').colorpicker();\n";
				$str .="						{if condition='\$info.".$fieldInfo['field']." eq \"\"'}\n";
				$str .="							$('#".$fieldInfo['field']."').val('');\n";
				$str .="						{/if}\n";
				$str .="					});\n";
				$str .="					</script>\n";
			break;
			
			//高德地图坐标选择器
			case 19:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				$str .="							<div class=\"input-group\" id=\"".$fieldInfo['field']."_address\">\n";
				$str .="							<textarea id=\"".$fieldInfo['field']."\" name=\"".$fieldInfo['field']."\"  class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">{\$info.".$fieldInfo['field']."}</textarea>\n";
				$str .="								<span class=\"input-group-addon\"><span class=\"glyphicon glyphicon-map-marker\"></span></span>\n";
				$str .="							</div>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				$str .="						</div>\n";
				$str .="					</div>\n";
				
				$str .="					<script type=\"text/javascript\" src=\"https://webapi.amap.com/maps?v=1.3&key=ed1fafa0307bb4991da41f54d8a88b46\"></script>\n";
				$str .="					<script src=\"__PUBLIC__/static/js/plugins/map/bootstrap.AMapPositionPicker.js\"></script>\n";
				$str .="					<script type=\"text/javascript\">\n";
				$str .="					$(function () {\n";
				$str .="						var p = $(\"#".$fieldInfo['field']."_address\").AMapPositionPicker();\n";
				$str .="					});\n";
				$str .="					</script>\n";
			break;
			
			//百度地图坐标选择器
			case 35:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				$str .="							<div class=\"input-group\" data-toggle=\"modal\" data-target=\"#".$fieldInfo['field']."Modal\">\n";
				$str .="							<textarea id=\"".$fieldInfo['field']."\" readonly name=\"".$fieldInfo['field']."\"  class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">{\$info.".$fieldInfo['field']."}</textarea>\n";
				$str .="								<span class=\"input-group-addon\"><span class=\"glyphicon glyphicon-map-marker\"></span></span>\n";
				$str .="							</div>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				$str .="						</div>\n";
				$str .="					</div>\n";
				
				$str .="					<div class=\"modal fade\" id=\"".$fieldInfo['field']."Modal\" tabindex=\"-1\" role=\"dialog\" aria-labelledby=\"".$fieldInfo['field']."ModalLabel\">\n";
				$str .="						<div class=\"modal-dialog\" role=\"document\">\n";
				$str .="							<div class=\"modal-content\">\n";
				$str .="								<div class=\"modal-header\">\n";
				$str .="									<button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-label=\"Close\"><span aria-hidden=\"true\">×</span></button>\n";
				$str .="										<h4 class=\"modal-title\" id=\"".$fieldInfo['field']."ModalLabel\">请选择地址</h4>\n";
				$str .="								</div>\n";
				$str .="								<div class=\"modal-body\">\n";
				$str .="									<div class=\"case\" style=\"height:350px;\">\n";
				$str .="										<div class=\"bMap\" id='".$fieldInfo['field']."Map'></div>\n";
				$str .="									</div>\n";
				$str .="								</div>\n";
				$str .="								<div class=\"modal-footer\">\n";
				$str .="									<button type=\"button\" class=\"btn btn-primary queren".$fieldInfo['field']."\">确认</button>\n";
				$str .="									<button type=\"button\" class=\"btn btn-default\" data-dismiss=\"modal\">取消</button>\n";
				$str .="								</div>\n";
				$str .="							</div>\n";
				$str .="						</div>\n";
				$str .="					</div>\n";
				
				$str .="					<script type=\"text/javascript\" src=\"http://api.map.baidu.com/api?v=2.0&ak=EZPCgQ6zGu6hZSmXlRrUMTpr\"></script>\n";
				$str .="					<script type=\"text/javascript\" src=\"__PUBLIC__/static/js/plugins/map/map.jquery.min.js\"></script>\n";
				$str .="					<script type=\"text/javascript\">\n";
				$str .="					$('#".$fieldInfo['field']."Modal').on('show.bs.modal', function (event) {\n";
				$str .="						var button = $(event.relatedTarget) // 触发事件的按钮\n";
				$str .="					});\n";
				
				$str .="					$(\"#".$fieldInfo['field']."Map\").bMap({name:\"callback\",callback:function(address,point){\n";
				$str .="						$(\".queren".$fieldInfo['field']."\").on('click',function(){\n";
				$str .="							var addre = {'longitude':point.lng,'latitude':point.lat,'address':$(\"#Map_input_callback\").val()};\n";
				$str .="							$(\"#".$fieldInfo['field']."\").val(JSON.stringify(addre));\n";
				$str .="							$(\"#".$fieldInfo['field']."Modal\").modal('hide');\n";
				$str .="						});\n";
				$str .="					}});\n";
				$str .="					</script>\n";
			break;
			
			//整数
			case 20:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//随机数
			case 21:
				if($type == 4){
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
					$str .="					<div class=\"form-group\">\n";
					$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
					$str .="						<div class=\"col-sm-9\">\n";
					$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
					if(!empty($fieldInfo['note'])){
						$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
					}
					
					$str .="						</div>\n";
					$str .="					</div>\n";
				}
			break;
			
			//排序
			case 22:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//标签输入
			case 28:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" class=\"form-control\" data-role=\"tagsinput\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\"  >\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//开关按钮
			case 23:
				$str .="					<div class=\"form-group layui-form\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";	

				$valArr = explode(',',$fieldInfo['config']);
				if($valArr){
					$value = (string) $fieldInfo['default_value'];
					if(empty($value) && $value <> '0'){
						$defaultValue = explode('|',$valArr[0])[1];
					}else{
						$defaultValue = $fieldInfo['default_value'];	
					}
					$str .="							<?php if(!isset(\$info['".$fieldInfo['field']."'])){ \$info['".$fieldInfo['field']."'] = ".$defaultValue."; }; ?>\n";	
					if($valArr){
						foreach($valArr as $k=>$v){
							$varArr = explode('|',$v);						
							$str .= "							<input name=\"".$fieldInfo['field']."\" value=\"".$varArr[1]."\" type=\"radio\" {if condition=\"\$info.".$fieldInfo['field']." eq '".$varArr[1]."'\"}checked{/if} title=\"".$varArr[0]."\">\n";
							
						}
					}
				}
				
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//订单号
			case 30:
				if($type == 4){
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
					$str .="					<div class=\"form-group\">\n";
					$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
					$str .="						<div class=\"col-sm-9\">\n";
					$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
					if(!empty($fieldInfo['note'])){
						$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
					}
					
					$str .="						</div>\n";
					$str .="					</div>\n";
				}
			break;
			
			//时间区间
			case 31:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				$defaultValue = "{\$info.".$fieldInfo['field']."}";
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			//键值对
			case 32:
				if($type == 3 || $type == 14){
					$str .="					<div class=\"form-group\">\n";
					$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
					$str .="						<div class=\"col-sm-9\">\n";
					$str .="							<div class=\"".$fieldInfo['field']."\">\n";
					$str .="								<div class=\"".$fieldInfo['field']."-line\">\n";
					$str .="									<label class=\"form-inline\" style=\"font-weight:normal;\">\n";
					$str .="										<input type=\"text\" class=\"form-control\" placeholder=\"名称\">\n";
					$str .="									</label>\n";
					$str .="									<label class=\"form-inline\" style=\"font-weight:normal;\">\n";
					$str .="										<input type=\"text\" class=\"form-control\" placeholder=\"值\">\n";
					$str .="									</label>\n";
					$str .="									<label class=\"form-inline btn-group-sm\">\n";
					$str .="										<button type=\"button\" class=\"btn btn-danger cancel\"><i class=\"fa fa-remove\"></i></button>\n";
					$str .="										<button type=\"button\" class=\"btn btn-info move\"><i class=\"fa fa-arrows\"></i></button>\n";
					$str .="									</label>\n";
					$str .="								</div>\n";
					$str .="							</div>\n";
					$str .="							<a  class=\"btn btn-primary btn-xs\" onclick=\"appendToVal('".$fieldInfo['field']."')\"><i class=\"fa fa-plus\"></i>&nbsp;追加</a>\n";
					if(!empty($fieldInfo['note'])){
						$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
					}
					
					$str .="						</div>\n";
					$str .="					</div>\n";
				}
				
				if($type == 4){
					$str .="					<div class=\"form-group\">\n";
					$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
					$str .="						<div class=\"col-sm-9\">\n";
					$str .="							<div class=\"".$fieldInfo['field']."\">\n";
					$str .="								<?php \$".$fieldInfo['field']." = json_decode(\$info['".$fieldInfo['field']."'],true);?>\n";
					$str .="								{foreach name=\"".$fieldInfo['field']."\" id=\"vo\"}\n";
					$str .="								<div class=\"".$fieldInfo['field']."-line\">\n";
					$str .="									<label class=\"form-inline\" style=\"font-weight:normal;\">\n";
					$str .="										<input type=\"text\" value=\"{\$key}\" class=\"form-control\" placeholder=\"名称\">\n";
					$str .="									</label>\n";
					$str .="									<label class=\"form-inline\" style=\"font-weight:normal;\">\n";
					$str .="										<input type=\"text\" value=\"{\$vo}\" class=\"form-control\" placeholder=\"值\">\n";
					$str .="									</label>\n";
					$str .="									<label class=\"form-inline btn-group-sm\">\n";
					$str .="										<button type=\"button\" class=\"btn btn-danger cancel\"><i class=\"fa fa-remove\"></i></button>\n";
					$str .="										<button type=\"button\" class=\"btn btn-info move\"><i class=\"fa fa-arrows\"></i></button>\n";
					$str .="									</label>\n";
					$str .="								</div>\n";
					$str .="								{/foreach}\n";
					$str .="							</div>\n";
					$str .="							<a class=\"btn btn-primary btn-xs\" onclick=\"appendToVal('".$fieldInfo['field']."')\"><i class=\"fa fa-plus\"></i>&nbsp;追加</a>\n";
					if(!empty($fieldInfo['note'])){
						$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
					}
					
					$str .="						</div>\n";
					$str .="					</div>\n";
				}
			break;
			
			//markdown编辑器
			case 33:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = '';
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="						<div id=\"".$fieldInfo['field']."\">\n";
				$str .="							<textarea style=\"display:none;\">".$defaultValue."</textarea>\n";
				$str .="							<link rel=\"stylesheet\" href=\"__PUBLIC__/static/js/meditor/css/editormd.css\" />\n";
				$str .="							<script src=\"__PUBLIC__/static/js/meditor/editormd.min.js\"></script>\n";
				$str .="							<script type=\"text/javascript\">\n";
				$str .="								var ".$fieldInfo['field'].";\n";
				$str .="								$(function() {\n";
				$str .="									".$fieldInfo['field']." = editormd(\"".$fieldInfo['field']."\", {\n";
				$str .="										width   : \"100%\",\n";
				$str .="										height  : 600,\n";
				$str .="										syncScrolling : \"single\",\n";
				$str .="										path    : \"__PUBLIC__/static/js/meditor/lib/\",\n";
				$str .="										imageUpload : true,\n";
				$str .="										imageFormats : [\"jpg\",\"jpeg\",\"gif\",\"png\",\"bmp\",\"webp\"],\n";
				$str .="										imageUploadURL : \"{:url('".$applicationInfo['app_dir']."/Upload/markDownUpload')}\",\n";
				$str .="										saveHTMLToTextarea : true\n";
				$str .="									});\n";
				$str .="								});\n";
				$str .="							</script>\n";
				$str .="						</div>\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
			default:
				$str .= ExtendService::getExtendFieldList($fieldInfo,$type,$applicationInfo,$menuInfo);
		}
		
		return $str;
	}
	
	
	//获取关联表的字段列表
	public static function getRelateFieldList($table_name){
		$where['b.app_type'] = 1;
		$where['a.table_name'] = $table_name;
		$menuInfo = db("menu")->field('a.*,b.*')->alias('a')->join('application b','a.app_id=b.app_id',"LEFT")->where($where)->find();
		try{
			$map['is_post'] = 1;
			$map['menu_id'] = $menuInfo['menu_id'];
			$fieldList =  Field::where($map)->select()->toArray();
		}catch(\Exception $e){
			return false;
		}
		
		return $fieldList;
	}
	
	//获取字段类型
	public static function getFieldType($fieldName,$menu_id){
		$info = Field::where(['field'=>$fieldName,'menu_id'=>$menu_id])->find();
		if($info){
			return $info->type;
		}
	}
	
	
	//判断字段是否存在数据表
	public static function getFieldStatus($field,$table_name,$connect){
		$list = Db::connect($connect)->query('show full columns from '.config('database.connections.'.$connect.'.prefix').$table_name);
		foreach($list as $key=>$val){
			$fields[] = $val['Field'];
		}
		foreach(explode('|',$field) as $k=>$v){
			if(in_array($v,$fields)){
				return true;
			}
		}
	}
	
	//检测方法是否生成验证器字段
	public static function checkValidateStatus($fields,$validata){
		$str = false;
		foreach(explode(',',$fields) as $key=>$val){
			if(in_array($val,$validata)){
				$str = true;
			}
		}
		return $str;
	}
	
	
	//数组根据key去重
	public static function array_unset_tt($arr,$key){
		//建立一个目标数组
		$res = array();
		foreach ($arr as $value) {
			//查看有没有重复项
			if(isset($res[$value[$key]])){
				unset($value[$key]);  //有：销毁
			}else{
				$res[$value[$key]] = $value;
			}
		}
		return $res;
	}
	
	
}
