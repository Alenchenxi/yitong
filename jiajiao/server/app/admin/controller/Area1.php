<?php
/*
 module:		地址管理
 create_time:	2022-11-10 11:19:42
 author:
 contact:
*/

namespace app\admin\controller;

use app\admin\service\AreaService;
use app\admin\model\Area as AreaModel;
use think\facade\Db;

class Area extends Admin {


    /*修改排序开关按钮操作*/
    function updateExt(){
        $postField = 'id,listorder,is_hot,is_direct_contact,is_nopay,refund_switch';
        $data = $this->request->only(explode(',',$postField),'post',null);
        if(!$data['id']) $this->error('参数错误');
        try{
            AreaModel::update($data);
        }catch(\Exception $e){
            abort(config('my.error_log_code'),$e->getMessage());
        }
        return json(['status'=>'00','msg'=>'操作成功']);
    }

    /*添加*/
    function add(){
        if (!$this->request->isPost()){
            return view('add');
        }else{
            $postField = 'parentid,name,listorder,is_hot,is_direct_contact,is_nopay,refund_switch';
            $data = $this->request->only(explode(',',$postField),'post',null);
            $res = AreaService::add($data);
            if($res && empty($data['listorder'])){
                AreaModel::update(['listorder'=>$res,'id'=>$res]);
            }
            return json(['status'=>'00','msg'=>'添加成功']);
        }
    }

    /*修改*/
    function update(){
        if (!$this->request->isPost()){
            $id = $this->request->get('id','','serach_in');
            if(!$id) $this->error('参数错误');
            $this->view->assign('info',checkData(AreaModel::find($id)));
            return view('update');
        }else{
            $postField = 'id,parentid,name,listorder,is_hot,is_direct_contact,is_nopay,refund_switch';
            $data = $this->request->only(explode(',',$postField),'post',null);
            $res = AreaService::update($data);
            return json(['status'=>'00','msg'=>'修改成功']);
        }
    }

    /*删除*/
    function delete(){
        $idx =  $this->request->post('id', '', 'serach_in');
        if(!$idx) $this->error('参数错误');
        try{
            AreaModel::destroy(['id'=>explode(',',$idx)],true);
        }catch(\Exception $e){
            abort(config('my.error_log_code'),$e->getMessage());
        }
        return json(['status'=>'00','msg'=>'操作成功']);
    }

    /*查看详情*/
    function view(){
        $id = $this->request->get('id','','serach_in');
        if(!$id) $this->error('参数错误');
        $this->view->assign('info',AreaModel::find($id));
        return view('view');
    }

    /*start*/
    /*首页数据列表*/
    function index() {
        if (!$this->request->isAjax()) {
            return view('index');
        } else {
            $limit = $this->request->post('limit', 20, 'intval');
            $offset = $this->request->post('offset', 0, 'intval');
            $page = floor($offset / $limit) + 1;

            $where = [];
            $where['name'] = $this->request->param('name_s', '', 'serach_in');
            $where['parentid'] = 0;

            $order = $this->request->post('order', '', 'serach_in'); //排序字段 bootstrap-table 传入
            $sort = $this->request->post('sort', '', 'serach_in'); //排序方式 desc 或 asc

            $field = 'id,name,listorder';
            $orderby = ($sort && $order) ? $sort . ' ' . $order : 'listorder asc,id asc';

            $res = AreaService::indexList(formatWhere($where), $field, $orderby, $limit, $page);
            return json($res);
        }
    }

    function cityList() {
        if (!$this->request->isAjax()) {
            return view('citylist');
        } else {
            $limit = $this->request->post('limit', 20, 'intval');
            $offset = $this->request->post('offset', 0, 'intval');
            $page = floor($offset / $limit) + 1;

            $where = [];
            $where['parentid'] = $this->request->param('id', '', 'serach_in');
            $where['name'] = $this->request->param('name_s', '', 'serach_in');

            $order = $this->request->post('order', '', 'serach_in'); //排序字段 bootstrap-table 传入
            $sort = $this->request->post('sort', '', 'serach_in'); //排序方式 desc 或 asc

            $field = 'id,name,listorder,is_hot,is_direct_contact,is_nopay,refund_switch';
            $orderby = ($sort && $order) ? $sort . ' ' . $order : 'listorder asc,id asc';

            $res = AreaService::indexList(formatWhere($where), $field, $orderby, $limit, $page);
            return json($res);
        }
    }
    /*end*/



}

