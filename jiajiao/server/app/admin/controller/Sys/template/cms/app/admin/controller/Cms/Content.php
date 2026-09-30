<?php
namespace app\admin\controller\Cms;
use app\admin\service\Cms\ContentService;
use app\admin\model\Cms\Content as ContentModel;
use app\admin\model\Cms\Catagory;
use app\admin\controller\Admin;

class Content extends Admin {


	/*内容管理*/
	function index(){
		if (!$this->request->isAjax()){
			$list = json_encode(ContentService::getSubClass('0'));
			$list = str_replace('class_name','title',$list);
			$list = str_replace('class_id','id',$list);
			$this->view->assign('catagoryInfo',$list);
			return view('cms/content/index');
		}else{
			$limit  = $this->request->post('limit', 0, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where['a.title'] = ['like',$this->request->param('title', '', 'strip_tags,trim')];
			$where['a.class_id'] = $this->request->param('class_id', '', 'strip_tags,trim');
			$where['a.status'] = $this->request->param('status', '', 'strip_tags,trim');

			$startTime = $this->request->param('startTime', '', 'strip_tags');
			$endTime = $this->request->param('endTime', '', 'strip_tags');

			$where['a.create_time'] = ['between',[strtotime($startTime),strtotime($endTime)]];

			$field = 'a.*,b.class_name';
			$orderby='sortid desc,content_id desc';
			$res = ContentService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			$list = $res['rows'];
			foreach($list as $key=>$val){
				if(!empty($val['pic'])){
					$list[$key]['title'] = $val['title'].'&nbsp;<img onmousemove=\'showBigPic("'.$val['pic'].'")\' onmouseout=\'closeimg()\' src="/static/img/pic.gif">&nbsp;';
				}			
				if(!empty($val['position'])){
					$list[$key]['title'] .= '&nbsp;'.ContentService::getPositionName($val['position'],$val['content_id']);
				}
				$list[$key]['create_time'] = date('Y-m-d',$val['create_time']);
			}

			$data['rows']  = $list;
			$data['total'] = $res['total'];
			return json($data);
		}
	}

	/*修改排序*/
	function updateExt(){
		$postField = 'content_id,status,sortid';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['content_id']) $this->error('参数错误');
		ContentModel::update($data);
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('cms/content/info');
		}else{
			$data = $this->request->post();
			$res = ContentService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$content_id = $this->request->get('content_id','','intval');
			if(!$content_id) $this->error('参数错误');
			$this->view->assign('info',checkData(ContentModel::find($content_id)->toArray()));
			return view('cms/content/info');
		}else{
			$data = $this->request->post();
			ContentService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('content_ids', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		ContentService::delete(['content_id'=>explode(',',$idx)]);
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	//删除推荐位
	public function delPosition(){
		$content_id = $this->request->post('content_id','','intval');
		$position_id = $this->request->post('position_id','','intval');
		if(empty($content_id) || empty($position_id)) $this->error('参数错误');
		ContentService::delPosition($content_id,$position_id);
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	
	//文章移动到其他栏目
	public function move(){
		$content_ids = $this->request->post('content_ids','','strval');
		$class_id = $this->request->post('class_id','','intval');
		if(empty($content_ids) || empty($class_id)) $this->error('参数错误');
		$data['class_id'] = $class_id;
		$res = ContentModel::where(['content_id'=>explode(',',$content_ids)])->update($data);
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	
	//设置推荐位
	public function setPosition(){
		$content_ids = $this->request->post('content_ids','','strval');
		$position_id = $this->request->post('position_id','','intval');
		if(empty($content_ids) || empty($position_id)) $this->error('参数错误');
		$idx = explode(',',$content_ids);
		if($idx){
			foreach ($idx as $id){
				ContentService::setPosition($id,$position_id);
			}
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	/*获取拓展字段信息*/
	function getExtends(){
		$class_id =  $this->request->post('class_id','','intval');
		$content_id = $this->request->post('content_id','','intval');
		$classInfo = Catagory::find($class_id);
		if(!$classInfo['module_id']) return json(['status'=>'01','upload_config_id'=>$classInfo['upload_config_id']]);
		//获取拓展表的内容信息
		if($content_id){
			$extInfo = db("menu")->where('menu_id',$classInfo['module_id'])->find();
			$extContentInfo = checkData(db($extInfo['table_name'])->where('content_id',$content_id)->find(),false);
		}
		
		$htmlstr = '';
		$fieldList = db('field')->where(['menu_id'=>$classInfo['module_id'],'is_post'=>1])->order('sortid asc')->select();
		if($fieldList){
			foreach($fieldList as $key=>$val){
				if($val['type'] == 17){
					$areaVal = explode('|',$val['field']);
					$val['province'] = $extContentInfo[$areaVal[0]];
					$val['city'] = $extContentInfo[$areaVal[1]];
					$val['district'] = $extContentInfo[$areaVal[2]];
				}else{
					$val['value'] = $extContentInfo[$val['field']];
				}

				if($content_id){
					$val['content_id'] = $content_id;
				}	
				$htmlstr .= \app\admin\service\Cms\ContentService::getFieldData($val);
			}
			$htmlstr = str_replace('col-sm-2','col-sm-1',$htmlstr);
			return json(['status'=>'00','fieldList'=>$fieldList,'data'=>$htmlstr,'upload_config_id'=>$classInfo['upload_config_id']]);
		}else{
			return json(['status'=>'01','upload_config_id'=>$classInfo['upload_config_id']]);
		}
	}
	
	function getThumbPic(){
		$detail = $this->request->post('detail','','strval');
		preg_match_all('/<[img|IMG].*?src=[\'|\"](.*?(?:[\.gif|\.jpg|\.png]))[\'|\"].*?[\/]?>/',$detail,$allImg);
		return json(['status'=>'00','imgurl'=>$allImg[1][0]]);
	}

}

