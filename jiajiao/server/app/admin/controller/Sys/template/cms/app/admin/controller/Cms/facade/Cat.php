<?php
namespace app\admin\controller\Cms\facade;

use think\Facade;

class Cat extends Facade
{
    protected static function getFacadeClass()
    {
    	return 'app\admin\service\Cms\CataTreeService';
    }
}