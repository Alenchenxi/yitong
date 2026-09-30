<?php
namespace app\cms\facade;

use think\Facade;

class Cat extends Facade
{
    protected static function getFacadeClass()
    {
    	return 'app\cms\service\CatagoryService';
    }
}