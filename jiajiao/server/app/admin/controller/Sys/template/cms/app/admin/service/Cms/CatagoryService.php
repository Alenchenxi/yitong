<?php 
namespace app\admin\service\Cms;
use app\admin\model\Cms\Catagory;
use think\exception\ValidateException;
use xhadmin\CommonService;

class CatagoryService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$orderby,$limit,$page){
		try{
			$res = db('catagory')->field($field)->alias('a')->join('menu b','a.module_id=b.menu_id','left')->where($where)->order($orderby)->paginate(['list_rows'=>$limit,'page'=>$page]);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res->items(),'total'=>$res->total()];
	}
	
	/*
 	* @Description  添加
 	*/
	public static function add($data){
		if(empty($data['class_name'])) throw new ValidateException('栏目名称不能为空');
		$filepath = self::getFilepath($data['class_name'],$data['class_id']);	
		if(empty($data['filepath'])){
			$filepath = rtrim(config('xhadmin.filepath'),'/').'/'.$filepath;
		}else{
			$filepath = $data['filepath'].'/'.$filepath;
		}
		$data['filepath'] = $filepath;
		try{
			$res = Catagory::create($data);
			if($res->class_id){
				Catagory::update(['class_id'=>$res->class_id,'sortid'=>$res->class_id]);
			}
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res->class_id;
	}


	/*
 	* @Description  修改
 	* @param (输入参数：)  {array}        data 原始数据
 	* @return (返回参数：) {bool}        
 	*/
	public static function update($data){
		if(empty($data['class_name'])) throw new ValidateException('栏目名称不能为空');
		if(empty($data['filepath']) || empty($data['filename'])){
			$data['filename'] = 'index.html';
			$data['filepath'] = rtrim(config('xhadmin.filepath'),'/').'/'.self::getFilepath($data['class_name'],$data['class_id']);
		}
		try{
			$res = Catagory::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res;
	}

	//排序上下移动
	public static function setSort($class_id,$type){
		$data = Catagory::find($class_id);
		if($type == 1){
			$where['sortid'] = ['<',$data['sortid']];
			$where['pid'] = $data['pid'];
			$info = Catagory::where(formatWhere($where))->order('sortid desc')->find();
		}else{
			$where['sortid'] = ['>',$data['sortid']];
			$where['pid'] = $data['pid'];
			$info = Catagory::where(formatWhere($where))->order('sortid asc')->find();
		}
		if($info && $data){
		    Catagory::update(['class_id'=>$class_id,'sortid'=>$info->sortid]);
			Catagory::update(['class_id'=>$info->class_id,'sortid'=>$data->sortid]);
		}
	}
	
	/**
     * 获取当前模板文件
     * @return array 文件列表
     */
    public static function tplList($default_themes=''){
        $tplDir=app()->getRootPath().'/app/ApplicationName/view/'.$default_themes;
        if(!is_dir($tplDir)){
            return false;
        }
        $listFile=scandir($tplDir);
        if(is_array($listFile)){
            $list=array();
            foreach ($listFile as $key => $value) {
                if ($value != "." && $value != "..") {
                    $list[$key]['file']=$value;
                    $list[$key]['name']=substr($value, 0, -5);
                }
            }
        }
        return $list;
    }
	
	 /**
     * 栏目拼音转换
     * @return string 栏目拼音
     */
    public static function getFilepath($classname,$classId){
		$classname = preg_replace('/\s+/', '-', $classname);
		$pattern = '/[^\x{4e00}-\x{9fa5}\d\w\-]+/u';
		$classname = preg_replace($pattern, '', $classname);
		$filepath = substr(\org\Pinyin::output($classname, true),0,30);
		$filepath = trim($filepath,'-');

        $where = [];
        if (!empty($classId)){
            $where['class_id'] = ['<>',$classId];
        }
        $where['filepath'] = $filepath;
        $info = Catagory::where(formatWhere($where))->find(); 
        if(empty($info)){
            return $filepath;
        }else{
            return $filepath.rand(1,9);
        }
    }


}

